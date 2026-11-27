/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 5 Batch 2 (`w5b2`) routines across
 * `0x6FC7AB00..0x6FCB94C0` (45 functions).
 */

import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { CHAT_GetUsed113c } from '../common/drlg/drlg-ver'
import { SEED_GetLowSeed113c } from '../common/drlg/drlg-grid'
import { PATH_WarpUnitToRoomAndCoord113c } from '../common/drlg/maze'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math'
import {
  INVENTORY_FreeInventory113c,
  INVENTORY_GetEquippedShield113c,
  INVENTORY_GetEquippedWeaponHandClass113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemEquipLocation113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetNodePage113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  ITEMS_GetDexBonusMemPort113c,
  ITEMS_GetStrBonusMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_GetWeaponMasteryBonusMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  MONSTERS_GetHirelingTypeId113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
} from '../common/missile'
import {
  PATH_Compute113c,
  PATH_ComputeSquaredDistance113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_SetCollisionMask113c,
  PATH_SetType113c,
} from '../common/path'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_ScaleValueByMasteryAndSkillParam1113c,
  SKILLS_SetParam1113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_ClearGfxStateFlag113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetSkillId113c,
  STATLIST_GetSkillLevel113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import { CHAT_CopyHoverMsg113c } from '../common/text'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_GetRoom113c,
  UNITS_SetPathRoomRefreshFlag113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit'
import { UNITFINDS_FindNearestUnitInRange113c } from '../common/unit-finds'
import {
  UNITS_GetField7C_113c,
  UNITS_GetPlayerData113c,
} from '../common/composit'
import { NET_SendPacket26_ChatMessage_6FCAB470_113c } from './k2-w4b4-113c'
import {
  INVENTORY_FreeAllItems_6FCAF470_113c,
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c,
  PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c,
  SKILLS_AddProgressiveChargeStage_6FCB5370_113c,
} from './k2-w4b5-113c'
import { SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c } from './k2-w4b6-113c'
import type { Memory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c } from '../prng'
import {
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c'
import {
  ITEMS_SyncSocketedSubItemsToClient113c,
  SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c,
  SKILLS_ApplyProgressiveChargesToDamage113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
} from './a1c-post150-f786-f1040-113c'
import {
  MONSTER_CheckTypeFlagsMask113c,
  SUNITDMG_FreeAttackerCombatList113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import {
  MONSTER_ApplyElementalDamageAndResistStats113c,
  NET_QueuePacketToClientBuffer113c,
  UNIT_SendFullUnitSyncToClient113c,
} from './boot-init-gap-a-113c'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  MONSTER_ApplyCritDamage113c,
  MONSTER_StartMode113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
} from './combat-a1c-113c'
import { PLAYER_GetEquippedWeapon113c } from './replay-kernel-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  AURA_ForEachUnitInRadius113c,
  STATES_CreateOrUpdateAuraStatList113c,
  SUNITDMG_AddElementalDamageToStruct113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  SKILLS_ResolveChargedSrvMissileId113c,
} from './k2-gap-melee-dot-113c'
import { QUESTS_SendPlayerQuestLogPacket28_113c } from './k2-items-tc-w1-113c'
import {
  SKILLS_GetParam2Fast_6FC21BC0_113c,
  SKILLS_GetParam5Fast_6FC21C50_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c'
import { SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c } from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c,
  ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c,
  ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c,
} from './k2-laneM-0x6fc7-w1-113c'
import {
  PARTY_GetPlayerRelationState113c,
  PARTY_TestPlayerRelationFlags113c,
  SUNIT_GetOwnerUnit113c,
} from './k2-sunit-spawn-w1-113c'
import {
  ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c,
  ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c,
} from './k2-w2b1-113c'
import {
  ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c,
  ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c,
  OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c,
} from './k2-w2b2-113c'
import {
  NET_SendPacket7A_SummonChange_6FCAB290_113c,
  NET_SendPacket81_AssignMerc_6FCAB220_113c,
  NET_ShouldSyncTrackedStatDelta_6FCAA330_113c,
} from './k2-w2b3-113c'
import {
  PARTY_FindSubPartyById_6FCBBD00_113c,
  SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c,
  SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c,
} from './k2-w2b4-113c'
import { SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c } from './k2-w2b5-113c'
import { STATES_PurgeExpStateStatLists_6FCDC920_113c } from './k2-w2b6-113c'
import { OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c } from './k2-w3b1-113c'
import {
  ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c,
  ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c,
} from './k2-w3b5-113c'
import {
  ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c,
  ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c,
  ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c,
} from './k2-w3b6-113c'
import {
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c,
  OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c,
  OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c,
} from './k2-w3b7-113c'
import { ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c } from './k2-w4b3-113c'
import {
  MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c,
  NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c,
  NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c,
} from './k2-w4b4-113c'
import {
  MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c,
  SKILLS_ApplyRadialDamageCallback_6FCB3040_113c,
} from './k2-w4b5-113c'
import { SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c } from './k2-w4b6-113c'
import {
  MONSTER_ClearModeEvents113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTATS_CheckFlagBit113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
} from './regpop-spawn-113c'
import {
  CLIENTS_GetPlayerUnit113c,
  SUNIT_FreeUnit113c,
} from './replay-final11-113c'
import { EVENT_SetEventFull113c } from './timer-wheel'
import { SUNIT_UpdateUnitPositionAndRoom113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

function sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(
  m: D2KernMemory113c,
  pDefender: number,
  pAttacker: number,
  pGame: number,
  nToHitBonus: number,
  nWeaponRangePenalty: number,
): number {
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  if (att === 0 || def === 0) return 0
  const attType = m.u32(att) | 0
  if (attType !== 0 && attType !== 1) return 0
  const defType = m.u32(def) | 0
  if (defType !== 0 && defType !== 1) return 0
  if ((SUNIT_AreUnitsHostileOrUnaligned113c(m, def, att, pGame >>> 0) | 0) === 0) return 0

  let wFlags = 0
  if (defType === 0 && (m.u32((def + 0x10) >>> 0) | 0) === 3) {
    wFlags = 1
  }

  let nAdder = attType === 1 ? 3 : 1
  if ((nWeaponRangePenalty | 0) !== 0) {
    const wpAdder = UNITS_GetEquippedWeaponAdder113c(m, att) | 0
    nAdder = (nAdder - (wpAdder + (nWeaponRangePenalty | 0))) | 0
  }
  if ((UNITS_CanUnitMeleeAttackTarget113c(m, att, def, nAdder) | 0) === 0) return 0

  if ((wFlags & 1) === 0) {
    if ((SUNITDMG_CheckToHit113c(m, att, def, 0, nToHitBonus | 0) | 0) !== 0) {
      wFlags |= 1
    }
  }

  if ((wFlags & 1) !== 0) {
    const blockMask = SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, def) | 0
    if ((blockMask & 2) !== 0) wFlags |= 0x100
    if ((blockMask & 4) !== 0) wFlags |= 0x80
    if ((blockMask & 0x10) !== 0) wFlags |= 0x8000
    if ((blockMask & 1) !== 0) wFlags |= 0x10
    if (blockMask !== 0) wFlags &= 0xfffe
  }

  if ((wFlags & 0x10) !== 0) {
    wFlags &= 0xfffe
  }

  if ((wFlags & 1) !== 0) {
    if ((STATES_CheckState113c(m, def, 0x36) | 0) === 0) {
      wFlags |= 4
    }
  }
  return wFlags & 0xffff
}

function sunitdmgRollDamageRange_6FCFBED0(
  m: D2KernMemory113c,
  nFlatAdd256: number,
  nMax256: number,
  nMinPct: number,
  pUnit: number,
  nMin256: number,
  nMaxPct: number,
): number {
  let maxVal = nMax256 | 0
  if (maxVal <= 0) {
    return (nFlatAdd256 | 0) < 0 ? 0 : nFlatAdd256 | 0
  }
  let minVal = nMin256 | 0
  minVal = (minVal + (mulDiv113c(minVal, nMinPct | 0, 100) | 0)) | 0
  maxVal = (maxVal + (mulDiv113c(maxVal, nMaxPct | 0, 100) | 0)) | 0
  let total = ((nFlatAdd256 | 0) + minVal) | 0
  if (maxVal > minVal) {
    const roll = SEED_RollLimitedFast113c(m, ((pUnit >>> 0) + 0x20) >>> 0, (maxVal - minVal) | 0) | 0
    total = (total + roll) | 0
  }
  return total < 0 ? 0 : total
}

function sunitdmgRollPhysicalDamage_6FCFC530(
  m: D2KernMemory113c,
  nBonusDmgPct: number,
  pAttacker: number,
  bUseUnitWeapon: number,
  pWeaponOverride: number,
  nOverrideMin256: number,
  nOverrideMax256: number,
  nFlatAdd256: number,
  bSrcDam: number,
): number {
  const attacker = pAttacker >>> 0
  let ediPct = nBonusDmgPct | 0
  let ebpMin = nOverrideMin256 | 0
  let ebxMax = nOverrideMax256 | 0
  let pWeapon = pWeaponOverride >>> 0

  if ((bUseUnitWeapon | 0) !== 0) {
    if (pWeapon === 0) {
      pWeapon = PLAYER_GetEquippedWeapon113c(m, attacker) >>> 0
    }
    if (pWeapon !== 0) {
      const handClass =
        INVENTORY_GetEquippedWeaponHandClass113c(m, attacker, m.u32((attacker + 0x60) >>> 0) >>> 0) | 0
      if (handClass === 2) {
        ebpMin = STATLIST_GetUnitStat113c(m, attacker, 0x17, 0) | 0
        ebxMax = STATLIST_GetUnitStat113c(m, attacker, 0x18, 0) | 0
      } else {
        ebpMin = STATLIST_GetUnitStat113c(m, attacker, 0x15, 0) | 0
        ebxMax = STATLIST_GetUnitStat113c(m, attacker, 0x16, 0) | 0
      }
    } else {
      ebpMin = STATLIST_GetUnitStat113c(m, attacker, 0x15, 0) | 0
      if (ebpMin <= 0) ebpMin = 1
      ebxMax = STATLIST_GetUnitStat113c(m, attacker, 0x16, 0) | 0
      if (ebxMax <= 1) ebxMax = 2
    }
    ebpMin = (ebpMin << 8) | 0
    ebxMax = (ebxMax << 8) | 0
  }

  const normalDmgAdd = (STATLIST_GetUnitStatWithLayer113c(m, attacker, 0x6f, 0) << 8) | 0
  ebpMin = (ebpMin + normalDmgAdd) | 0
  ebxMax = (ebxMax + normalDmgAdd) | 0
  if (ebpMin < 1) ebpMin = 0x100
  if (ebxMax <= ebpMin) ebxMax = (ebpMin + 0x100) | 0

  ediPct = (ediPct + (STATLIST_GetUnitStat113c(m, attacker, 0x19, 0) | 0)) | 0
  const minDmgPct = STATLIST_GetUnitStat113c(m, attacker, 0x12, 0) | 0
  const maxDmgPct = STATLIST_GetUnitStat113c(m, attacker, 0x11, 0) | 0

  if (pWeapon !== 0) {
    const strBonus = (ITEMS_GetStrBonusMemPort113c(m, pWeapon) << 16) >> 16
    if (strBonus !== 0) {
      const str = STATLIST_GetUnitStat113c(m, attacker, 0, 0) | 0
      ediPct = (ediPct + sdiv32(imul32(str, strBonus), 100)) | 0
    }
    const dexBonus = (ITEMS_GetDexBonusMemPort113c(m, pWeapon) << 16) >> 16
    if (dexBonus !== 0) {
      const dex = STATLIST_GetUnitStat113c(m, attacker, 2, 0) | 0
      ediPct = (ediPct + sdiv32(imul32(dex, dexBonus), 100)) | 0
    }
    ediPct = (ediPct + (SKILLS_GetWeaponMasteryBonusMemPort113c(m, attacker, pWeapon, 0, 1) | 0)) | 0
  } else if ((bUseUnitWeapon | 0) !== 0) {
    ediPct = (ediPct + (STATLIST_GetUnitStat113c(m, attacker, 0, 0) | 0)) | 0
  }

  if (ediPct <= -90) {
    ediPct = -90
  }

  const rolled =
    sunitdmgRollDamageRange_6FCFBED0(
      m,
      nFlatAdd256 | 0,
      ebxMax,
      (minDmgPct + ediPct) | 0,
      attacker,
      ebpMin,
      (maxDmgPct + ediPct) | 0,
    ) | 0

  const srcDam = bSrcDam & 0xff
  if (srcDam === 0x80) {
    return rolled
  }
  return Number((BigInt(rolled) * BigInt(srcDam)) / 128n) | 0
}

function sunitdmgKillUnit_6FCFEEE0(
  m: D2KernMemory113c,
  pGame: number,
  pDefender: number,
): void {
  SUNITDMG_DistributeExperience113c(m, pGame >>> 0, pDefender >>> 0, 0, 0, true)
}

function partyIteratePartyMembers_6FCBC160(
  m: D2KernMemory113c,
  pGame: number,
  wPartyId: number,
  pArg: number,
  pfnCallback: (m: D2KernMemory113c, pGame: number, pPlayer: number, pArg: number) => void,
): void {
  const game = pGame >>> 0
  const partyId = wPartyId & 0xffff
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, game, partyId) >>> 0
  if (pSubParty === 0 || partyId === 0xffff) {
    return
  }
  let pMember = m.u32((pSubParty + 0x04) >>> 0) >>> 0
  while (pMember !== 0) {
    const dwUnitId = m.u32(pMember) >>> 0
    if (game === 0) {
      throw new D2CommonAssertError('pGame', 0x2d3)
    }
    const bucketIdx = dwUnitId & 0x7f
    let pPlayer = m.u32((game + 0x1120 + bucketIdx * 4) >>> 0) >>> 0
    while (pPlayer !== 0) {
      if ((m.u32((pPlayer + 0x0c) >>> 0) >>> 0) === dwUnitId) {
        pfnCallback(m, game, pPlayer, pArg >>> 0)
        break
      }
      pPlayer = m.u32((pPlayer + 0xe4) >>> 0) >>> 0
    }
    pMember = m.u32((pMember + 0x04) >>> 0) >>> 0
  }
}

/**
 * @va D2Game:0x6FC7AB00
 */
export function ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7AB00)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x28, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC7AF50
 */
export function ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7AF50)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x26, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC7B030
 */
export function ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC7B030)
  const edi = pQuestArg >>> 0
  const ebx = m.u32((edi + 0x04) >>> 0) >>> 0
  const esi = pPlayer >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, esi, ebx, 0x20656369) !== 0) {
    return 1
  }
  const ebp = m.u32((edi + 0x18) >>> 0) >>> 0
  if (esi === 0) {
    return 0
  }
  const pUnitGame = m.u32((esi + 0x80) >>> 0) >>> 0
  if (pUnitGame === 0 || m.u32(esi) !== 0) {
    return 0
  }
  const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, esi, pUnitGame) & 0xffff
  if (wPartyId === 0xffff) {
    return 0
  }
  m.setU8((ebp + 0xe2) >>> 0, 0)
  const pGame2 = m.u32((edi + 0x04) >>> 0) >>> 0
  partyIteratePartyMembers_6FCBC160(
    m,
    pGame2,
    wPartyId,
    0,
    ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c,
  )
  return m.u8((ebp + 0xe2) >>> 0) !== 0 ? 1 : 0
}

/**
 * @va D2Game:0x6FC7B120
 */
export function ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7B120)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x25, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC7B180
 */
export function ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7B180)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x24, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC7B490
 */
export function ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7B490)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x23, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC83D70
 */
export function ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC83D70)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x06, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC84150
 */
export function ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC84150)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x05, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC848B0
 */
export function ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC848B0)
  const esi = pGame >>> 0
  const edi = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, edi) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const ebx = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, ebx, 4, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, ebx, 4, 1) === 1) {
    return 0
  }
  const pRoom = UNITS_GetRoom113c(m, edi) >>> 0
  if (pRoom === 0) {
    return 0
  }
  if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) !== 0x26) {
    return 0
  }
  QUESTRECORD_SetQuestState113c(m, ebx, 4, 0x0d)
  QUESTRECORD_SetQuestState113c(m, ebx, 4, 1)
  QUESTS_SendPlayerQuestLogPacket28_113c(m, edi, esi)
  let wPartyId = 0xffff
  if (edi !== 0 && m.u32(edi) === 0) {
    const pUnitGame = m.u32((edi + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0) {
      wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, edi, pUnitGame) & 0xffff
    }
  }
  if (wPartyId !== 0xffff) {
    partyIteratePartyMembers_6FCBC160(
      m,
      esi,
      wPartyId,
      0,
      ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c,
    )
  }
  return 0
}

/**
 * @va D2Game:0x6FC84B60
 */
export function ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC84B60)
  const esi = pPlayer >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError('pUnit', 0xa2a)
  }
  const ebx = m.u32((esi + 0x80) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, esi, ebx, 0x206d6468) !== 0) {
    return 1
  }
  const pArg = pQuestArg >>> 0
  const ebp = m.u32((pArg + 0x18) >>> 0) >>> 0
  const edi = m.u32((esi + 0x80) >>> 0) >>> 0
  if (edi === 0 || m.u32(esi) !== 0) {
    return 0
  }
  const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, esi, edi) & 0xffff
  if (wPartyId === 0xffff) {
    return 0
  }
  m.setU8((ebp + 0xa0) >>> 0, 0)
  const pGame2 = m.u32((pArg + 0x04) >>> 0) >>> 0
  partyIteratePartyMembers_6FCBC160(
    m,
    pGame2,
    wPartyId,
    0,
    ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c,
  )
  return m.u8((ebp + 0xa0) >>> 0) !== 0 ? 1 : 0
}

let k2W5B2StackPtr = 0x7efc0000
function allocW5B2Stack(m: D2KernMemory113c, bytes: number): number {
  const aligned = ((bytes + 7) & ~7) >>> 0
  const sp = k2W5B2StackPtr >>> 0
  k2W5B2StackPtr = (sp + aligned) >>> 0
  m.fill(sp, aligned, 0)
  return sp
}

function readSgptDataTables113c(m: D2KernMemory113c): number {
  const ptrAddr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (ptrAddr === 0) return 0
  return m.u32(ptrAddr) >>> 0
}

function summonIteratePlayerPets_6FCB6AF0(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pArg: number,
  pfnCallback: (m: D2KernMemory113c, pPetUnit: number, pArg: number) => number,
): void {
  const edi = pGame >>> 0
  const ebp = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebp) >>> 0
  if (pPlayerData === 0) {
    return
  }
  const pPetList = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetList === 0) {
    return
  }
  const pDataTables = readSgptDataTables113c(m)
  const nPetTypesCount = pDataTables !== 0 ? m.u32((pDataTables + 0xbf0) >>> 0) | 0 : 0
  for (let edx = 1, ecx = 0x0c; edx < nPetTypesCount; edx = (edx + 1) | 0, ecx = (ecx + 0x0c) | 0) {
    if (ecx < 0) continue
    const pArray = m.u32(pPetList) >>> 0
    const pSlot = (pArray + ecx) >>> 0
    if (pSlot === 0) continue
    let esi = m.u32(pSlot) >>> 0
    while (esi !== 0) {
      if ((m.u8(esi) & 1) === 0) {
        const dwPetGuid = m.u32((esi + 0x04) >>> 0) >>> 0
        if (edi === 0) {
          throw new D2CommonAssertError('pGame', 0x2d3)
        }
        const bucketIdx = dwPetGuid & 0x7f
        let pMon = m.u32((edi + 0x1320 + bucketIdx * 4) >>> 0) >>> 0
        while (pMon !== 0) {
          if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwPetGuid) {
            pfnCallback(m, pMon, pArg >>> 0)
            break
          }
          pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
        }
      }
      esi = m.u32((esi + 0x14) >>> 0) >>> 0
    }
  }
}

/**
 * @va D2Game:0x6FC84FE0
 */
export function ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC84FE0)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x02, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC85200
 */
export function ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC85200)
  const esi = pGame >>> 0
  const ebx = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  const nDiff = m.u8((esi + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestData, 0x01, 0x0d) !== 0 && ebx !== 0) {
    const edi = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (edi !== 0 && m.u32(ebx) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, edi) & 0xffff
      if (wPartyId !== 0xffff) {
        partyIteratePartyMembers_6FCBC160(
          m,
          esi,
          wPartyId,
          0,
          ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c,
        )
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FC88FC0
 */
export function ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC88FC0)
  const esi = pOperateArgs >>> 0
  const ediGame = m.u32(esi) >>> 0
  const pQuestChain = m.u32((ediGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestChain !== 0 ? m.u32(pQuestChain) >>> 0 : 0
  while (pQuest !== 0 && m.u32(pQuest) !== 4) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  let ebx = 0
  if (pQuest !== 0) {
    const cl = m.u8((pQuest + 0x09) >>> 0)
    ebx = m.u32((pQuest + 0x18) >>> 0) >>> 0
    if (cl === 0 || m.u8((ebx + 0x50) >>> 0) === 1 || m.u8((pQuest + 0x0c) >>> 0) >= 6) {
      return 0
    }
  }
  const pPlayer = m.u32((esi + 0x08) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((ediGame + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestData, 4, 1) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestData, 4, 0) !== 0
  ) {
    const pPlr = m.u32((esi + 0x08) >>> 0) >>> 0
    SUNIT_SetUnitEventSound113c(m, pPlr, 0x13, pPlr)
    return 0
  }
  const nObjectId = m.u32((esi + 0x10) >>> 0) | 0
  const ebp = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
  const pObject = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0
  }
  UNITS_ChangeAnimMode113c(m, pObject, 1)
  const pGame1 = m.u32(esi) >>> 0
  const frameDelta = m.u32((ebp + 0xdc) >>> 0) >>> 8
  const curFrame1 = m.u32((pGame1 + 0xa8) >>> 0) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGame1,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    1,
    (curFrame1 + frameDelta) >>> 0,
    0,
    0,
    0,
  )
  if (ebx !== 0) {
    m.setU32((ebx + 0x54) >>> 0, 3)
    const pPlr = m.u32((esi + 0x08) >>> 0) >>> 0
    const dwPlrGuid = pPlr !== 0 ? m.u32((pPlr + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((ebx + 0x3c) >>> 0, dwPlrGuid)
  }
  const pGame2 = m.u32(esi) >>> 0
  const curFrame2 = m.u32((pGame2 + 0xa8) >>> 0) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGame2,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    7,
    (curFrame2 + 0x11) >>> 0,
    0,
    0,
    0,
  )
  const pObjRoom = UNITS_GetRoom113c(m, m.u32((esi + 0x04) >>> 0) >>> 0) >>> 0
  DUNGEON_ToggleHasPortalFlag113c(m, pObjRoom, 0)
  QUESTRECORD_SetQuestState113c(m, pQuestData, 4, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestData, 4, 1)
  QUESTS_SendPlayerQuestLogPacket28_113c(
    m,
    m.u32((esi + 0x08) >>> 0) >>> 0,
    m.u32(esi) >>> 0,
  )
  const pPlrParty = m.u32((esi + 0x08) >>> 0) >>> 0
  let wPartyId = 0xffff
  if (pPlrParty !== 0 && m.u32(pPlrParty) === 0) {
    const pUnitGame = m.u32((pPlrParty + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0) {
      wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlrParty, pUnitGame) & 0xffff
    }
  }
  if (wPartyId !== 0xffff) {
    partyIteratePartyMembers_6FCBC160(
      m,
      m.u32(esi) >>> 0,
      wPartyId,
      0,
      ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c,
    )
  }
  return 0
}

/**
 * @va D2Game:0x6FC8A560
 */
export function OBJ_UseWellHealPlayerAndPets_6FC8A560_113c(
  m: D2KernMemory113c,
  pObjectsTxtRecord: number,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC8A560)
  const ebx = pObjectsTxtRecord >>> 0
  const esi = pUnit >>> 0
  let bHealed = 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, esi) >>> 0
  const curLife = STATLIST_GetUnitStat113c(m, esi, 6, 0) >>> 0
  const dwFlags = m.u32((ebx + 0x184) >>> 0) >>> 0
  if (curLife < maxLife && (dwFlags & 2) !== 0) {
    const pct = m.u32((ebx + 0x17c) >>> 0)
    let newLife = (((imul32(pct, maxLife) >>> 0) >>> 8) + curLife) >>> 0
    if (newLife > maxLife) {
      newLife = maxLife
    }
    STATLIST_SetUnitStat113c(m, esi, 6, newLife | 0, 0)
    D2GAME_PLRMODES_SendStatToClientOrParty113c(m, esi, 6, esi, newLife | 0)
    bHealed = 1
  }
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, esi) >>> 0
  const curMana = STATLIST_GetUnitStat113c(m, esi, 8, 0) >>> 0
  if (curMana < maxMana && (dwFlags & 1) !== 0) {
    const pct = m.u32((ebx + 0x17c) >>> 0)
    let newMana = (((imul32(pct, maxMana) >>> 0) >>> 8) + curMana) >>> 0
    if (newMana > maxMana) {
      newMana = maxMana
    }
    STATLIST_SetUnitStat113c(m, esi, 8, newMana | 0, 0)
    D2GAME_PLRMODES_SendStatToClientOrParty113c(m, esi, 8, esi, newMana | 0)
    bHealed = 1
  }
  const maxStam = STATLIST_GetMaxStaminaFromUnit113c(m, esi) >>> 0
  const curStam = STATLIST_GetUnitStat113c(m, esi, 0x0a, 0) >>> 0
  if (curStam < maxStam) {
    const pct = m.u32((ebx + 0x17c) >>> 0)
    let newStam = (((imul32(pct, maxStam) >>> 0) >>> 8) + curStam) >>> 0
    if (newStam > maxStam) {
      newStam = maxStam
    }
    STATLIST_SetUnitStat113c(m, esi, 0x0a, newStam | 0, 0)
    D2GAME_PLRMODES_SendStatToClientOrParty113c(m, esi, 0x0a, esi, newStam | 0)
    bHealed = 1
  }
  const pPoisonList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 2) >>> 0
  if (pPoisonList !== 0) {
    STATLIST_UnlinkSubList113c(m, esi, pPoisonList)
    STATLIST_FreeStatListIfNonExtended113c(m, pPoisonList)
    bHealed = 1
  }
  const pFreezeList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 1) >>> 0
  if (pFreezeList !== 0) {
    STATLIST_UnlinkSubList113c(m, esi, pFreezeList)
    STATLIST_FreeStatListIfNonExtended113c(m, pFreezeList)
    bHealed = 1
  }
  if (STATES_PurgeExpStateStatLists_6FCDC920_113c(m, esi) !== 0) {
    bHealed = 1
  }
  const pbHealed = k2W5B2StackPtr
  k2W5B2StackPtr = (k2W5B2StackPtr + 4) >>> 0
  try {
    m.setU32(pbHealed, bHealed >>> 0)
    summonIteratePlayerPets_6FCB6AF0(
      m,
      pGame >>> 0,
      esi,
      pbHealed,
      OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c,
    )
    return m.u32(pbHealed) | 0
  } finally {
    k2W5B2StackPtr = pbHealed
  }
}

/**
 * @va D2Game:0x6FC8B8A0
 */
export function OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): void {
  hitD2GameVa113c(0x6FC8B8A0)
  const esi = pOperateArgs >>> 0
  const pPlayer1 = m.u32((esi + 0x08) >>> 0) >>> 0
  const uType1 = m.u32(pPlayer1) | 0
  let ediY: number
  if (uType1 === 2 || (uType1 > 3 && uType1 <= 5)) {
    const pPath = m.u32((pPlayer1 + 0x2c) >>> 0) >>> 0
    ediY = m.u32((pPath + 0x10) >>> 0) | 0
  } else {
    const pPath = m.u32((pPlayer1 + 0x2c) >>> 0) >>> 0
    ediY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
  }
  const pPlayer2 = m.u32((esi + 0x08) >>> 0) >>> 0
  const uType2 = m.u32(pPlayer2) | 0
  let eaxX: number
  if (uType2 === 2 || (uType2 > 3 && uType2 <= 5)) {
    const pPath = m.u32((pPlayer2 + 0x2c) >>> 0) >>> 0
    eaxX = m.u32((pPath + 0x0c) >>> 0) | 0
  } else {
    const pPath = m.u32((pPlayer2 + 0x2c) >>> 0) >>> 0
    eaxX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
  }
  const edxPlayer = m.u32((esi + 0x08) >>> 0) >>> 0
  const pFound =
    UNITFINDS_FindNearestUnitInRange113c(
      m,
      edxPlayer,
      eaxX,
      ediY,
      0,
      0x6fc8a440,
      (mem, cand, src) => OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c(mem, cand, src),
    ) >>> 0
  if (pFound !== 0) {
    MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c(m, pFound, m.u32(esi) >>> 0)
  }
}

const DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C: readonly number[] = [
  0, 0x6fc8a4e0, 0x6fc8a750, 0x6fc8a780, 0x6fc8a840, 0x6fc8a870, 0x6fc8a960, 0x6fc8aa00,
  0x6fc8aa80, 0x6fc8ab20,
]

function objScheduleObjectTrapEventOrSound_6FC8DD60(
  m: D2KernMemory113c,
  pOperateArgs: number,
  bTrapIndex: number,
): void {
  const edi = pOperateArgs >>> 0
  const esiIdx = bTrapIndex & 0xff
  const rawMax = m.u32(0x6fd27bb4) | 0
  const maxIdx = rawMax !== 0 ? rawMax : 10
  if (esiIdx >= maxIdx) return
  const inMemHandler = m.u32((0x6fd27b8c + (esiIdx << 2)) >>> 0) >>> 0
  const handlerVa =
    inMemHandler !== 0
      ? inMemHandler
      : rawMax === 0 && esiIdx < DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C.length
        ? DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C[esiIdx]!
        : 0
  if (handlerVa === 0) return
  if (handlerVa === 0xffffffff) {
    throw new D2CommonAssertError('Objects.cpp', 0x56c)
  }
  if (handlerVa === 0x6fc8a4e0) {
    const nClassId = OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, edi) | 0
    const pRoom = UNITS_GetRoom113c(m, m.u32((edi + 0x04) >>> 0) >>> 0) >>> 0
    if (OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoom, nClassId) === 0) {
      return
    }
  }
  const pGame = m.u32(edi) >>> 0
  const frame = (m.u32((pGame + 0xa8) >>> 0) + 0x23) >>> 0
  EVENT_SetEventFull113c(m, pGame, m.u32((edi + 0x04) >>> 0) >>> 0, 4, frame, 0, 0, 0)
  SUNIT_SetUnitEventSound113c(m, m.u32((edi + 0x04) >>> 0) >>> 0, 0x0d, 0)
}

function copyNullTerminated113c(
  m: D2KernMemory113c,
  pDest: number,
  pSrc: number,
  nMaxLen: number,
): number {
  const dst = pDest >>> 0
  const src = pSrc >>> 0
  const max = nMaxLen >>> 0
  if (max === 0) return 0
  let i = 0
  while (i + 1 < max) {
    const ch = m.u8((src + i) >>> 0)
    m.setU8((dst + i) >>> 0, ch)
    if (ch === 0) {
      return i
    }
    i += 1
  }
  m.setU8((dst + i) >>> 0, 0)
  return i
}

function netSendChatHoverOrMessagePacket26_6FCAB470(
  m: D2KernMemory113c,
  pChatStruct: number,
  pClient: number,
): void {
  const eax = pChatStruct >>> 0
  const ediMsg = (eax + 0x1a) >>> 0
  let msgLen = 0
  while (m.u8((ediMsg + msgLen) >>> 0) !== 0) {
    msgLen += 1
  }
  if (msgLen >= 0x100) {
    throw new D2CommonAssertError('S2C.cpp', 0x5ba)
  }
  if (m.u8((eax + 0x119) >>> 0) !== 0) {
    m.setU8((eax + 0x119) >>> 0, 0)
  }
  const pPkt = k2W5B2StackPtr
  k2W5B2StackPtr = (k2W5B2StackPtr + 0x120) >>> 0
  try {
    m.setU8(pPkt, m.u8(eax))
    m.setU8((pPkt + 1) >>> 0, m.u8((eax + 1) >>> 0))
    m.setU8((pPkt + 2) >>> 0, m.u8((eax + 2) >>> 0))
    m.setU8((pPkt + 3) >>> 0, m.u8((eax + 3) >>> 0))
    m.setU32((pPkt + 4) >>> 0, m.u32((eax + 4) >>> 0) >>> 0)
    m.setU8((pPkt + 8) >>> 0, m.u8((eax + 8) >>> 0))
    m.setU8((pPkt + 9) >>> 0, m.u8((eax + 9) >>> 0))
    const len1 = copyNullTerminated113c(m, (pPkt + 10) >>> 0, (eax + 10) >>> 0, 0x10)
    const pMsgDst = (pPkt + 11 + len1) >>> 0
    const len2 = copyNullTerminated113c(m, pMsgDst, ediMsg, 0x100)
    const totalLen = (11 + len1 + len2 + 1) >>> 0
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, totalLen)
  } finally {
    k2W5B2StackPtr = pPkt
  }
}

/**
 * @va D2Game:0x6FC8EB40
 */
export function OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8EB40)
  const edi = pOperateArgs >>> 0
  const pObject = m.u32((edi + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 1
  }
  UNITS_ChangeAnimMode113c(m, pObject, 1)
  const pObj2 = m.u32((edi + 0x04) >>> 0) >>> 0
  if (pObj2 !== 0) {
    m.setU32((pObj2 + 0xc4) >>> 0, (m.u32((pObj2 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }
  const esiTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((edi + 0x10) >>> 0) | 0) >>> 0
  const pGame1 = m.u32(edi) >>> 0
  const frame1 =
    ((m.u32((esiTxt + 0xdc) >>> 0) >>> 8) + m.u32((pGame1 + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame1, m.u32((edi + 0x04) >>> 0) >>> 0, 1, frame1, 0, 0, 0)
  const pGame2 = m.u32(edi) >>> 0
  const frame2 = (m.u32((pGame2 + 0xa8) >>> 0) + m.u32((esiTxt + 0x17c) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame2, m.u32((edi + 0x04) >>> 0) >>> 0, 0x0a, frame2, 0, 0, 0)
  if (m.u8((esiTxt + 0x121) >>> 0) === 0) {
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((edi + 0x04) >>> 0) >>> 0)
  }
  const pObj3 = m.u32((edi + 0x04) >>> 0) >>> 0
  const pObjData = m.u32((pObj3 + 0x14) >>> 0) >>> 0
  objScheduleObjectTrapEventOrSound_6FC8DD60(m, edi, m.u8((pObjData + 0x04) >>> 0) & 0x7f)
  const pPlayer = m.u32((edi + 0x08) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const pField7C = UNITS_GetField7C_113c(m, m.u32((edi + 0x04) >>> 0) >>> 0) >>> 0
  if (pField7C !== 0) {
    m.setU32((pField7C + 0x04) >>> 0, dwPlayerGuid)
  }
  return 1
}

/**
 * @va D2Game:0x6FC8EC20
 */
export function OBJ_OperateChestAndDropTreasure_6FC8EC20_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8EC20)
  const edi = pOperateArgs >>> 0
  const pObject = m.u32((edi + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 1
  }
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, edi, 0)
  const pRoom = UNITS_GetRoom113c(m, m.u32((edi + 0x04) >>> 0) >>> 0) >>> 0
  DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const esiTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((edi + 0x10) >>> 0) | 0) >>> 0
  UNITS_ChangeAnimMode113c(m, m.u32((edi + 0x04) >>> 0) >>> 0, 1)
  const pGame = m.u32(edi) >>> 0
  const frame1 =
    ((m.u32((esiTxt + 0xdc) >>> 0) >>> 8) + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, m.u32((edi + 0x04) >>> 0) >>> 0, 1, frame1, 0, 0, 0)
  const pObj2 = m.u32((edi + 0x04) >>> 0) >>> 0
  if (pObj2 !== 0) {
    m.setU32((pObj2 + 0xc4) >>> 0, (m.u32((pObj2 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }
  if (m.u8((esiTxt + 0x121) >>> 0) === 0) {
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((edi + 0x04) >>> 0) >>> 0)
  }
  const pObj3 = m.u32((edi + 0x04) >>> 0) >>> 0
  const pObjData = m.u32((pObj3 + 0x14) >>> 0) >>> 0
  objScheduleObjectTrapEventOrSound_6FC8DD60(m, edi, m.u8((pObjData + 0x04) >>> 0) & 0x7f)
  return 1
}

/**
 * @va D2Game:0x6FC8ECD0
 */
export function OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8ECD0)
  const edi = pOperateArgs >>> 0
  const pObject = m.u32((edi + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 1
  }
  const pRoom = UNITS_GetRoom113c(m, pObject) >>> 0
  DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  UNITS_ChangeAnimMode113c(m, m.u32((edi + 0x04) >>> 0) >>> 0, 1)
  const pObj2 = m.u32((edi + 0x04) >>> 0) >>> 0
  if (pObj2 !== 0) {
    m.setU32((pObj2 + 0xc4) >>> 0, (m.u32((pObj2 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }
  const esiTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((edi + 0x10) >>> 0) | 0) >>> 0
  const pGame = m.u32(edi) >>> 0
  const frame1 =
    ((m.u32((esiTxt + 0xdc) >>> 0) >>> 8) + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, m.u32((edi + 0x04) >>> 0) >>> 0, 1, frame1, 0, 0, 0)
  const pSeed = m.u32((edi + 0x0c) >>> 0) >>> 0
  const low = BigInt(m.u32(pSeed) >>> 0)
  const high = BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const prod = low * 0x6ac690c5n + high
  const eaxNew = Number(prod & 0xffffffffn) >>> 0
  const edxNew = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 0x04) >>> 0, edxNew)
  m.setU32(pSeed, eaxNew)
  if ((eaxNew % 0x64) <= 0x14) {
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, edi, 0)
  }
  if (m.u8((esiTxt + 0x121) >>> 0) === 0) {
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((edi + 0x04) >>> 0) >>> 0)
  }
  const pObj3 = m.u32((edi + 0x04) >>> 0) >>> 0
  const pObjData = m.u32((pObj3 + 0x14) >>> 0) >>> 0
  objScheduleObjectTrapEventOrSound_6FC8DD60(m, edi, m.u8((pObjData + 0x04) >>> 0) & 0x7f)
  return 1
}

/**
 * @va D2Game:0x6FC8EF40
 */
export function OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8EF40)
  const esi = pOperateArgs >>> 0
  const pObject = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 1
  }
  if (OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, esi, 0) === 0) {
    return 1
  }
  const pRoom = UNITS_GetRoom113c(m, m.u32((esi + 0x04) >>> 0) >>> 0) >>> 0
  DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  UNITS_ChangeAnimMode113c(m, m.u32((esi + 0x04) >>> 0) >>> 0, 1)
  const pObj2 = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObj2 !== 0) {
    m.setU32((pObj2 + 0xc4) >>> 0, (m.u32((pObj2 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }
  const ediTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((esi + 0x10) >>> 0) | 0) >>> 0
  const pGame = m.u32(esi) >>> 0
  const frame1 =
    ((m.u32((ediTxt + 0xdc) >>> 0) >>> 8) + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, m.u32((esi + 0x04) >>> 0) >>> 0, 1, frame1, 0, 0, 0)
  const pSeed = m.u32((esi + 0x0c) >>> 0) >>> 0
  const low = BigInt(m.u32(pSeed) >>> 0)
  const high = BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const prod = low * 0x6ac690c5n + high
  const eaxNew = Number(prod & 0xffffffffn) >>> 0
  const edxNew = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 0x04) >>> 0, edxNew)
  m.setU32(pSeed, eaxNew)
  if (((eaxNew % 0x2710) & 0xffffe000) !== 0) {
    const nMonId = OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, esi)
    OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(m, nMonId, esi, 8)
  }
  if (m.u8((ediTxt + 0x121) >>> 0) === 0) {
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((esi + 0x04) >>> 0) >>> 0)
  }
  const pObj3 = m.u32((esi + 0x04) >>> 0) >>> 0
  const pObjData = m.u32((pObj3 + 0x14) >>> 0) >>> 0
  objScheduleObjectTrapEventOrSound_6FC8DD60(m, esi, m.u8((pObjData + 0x04) >>> 0) & 0x7f)
  return 1
}

/**
 * @va D2Game:0x6FC9ACB0
 */
export function SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9ACB0)
  const ebx = pUnit >>> 0
  const esiClient = pClient >>> 0
  const pHoverMsg = ebx !== 0 ? m.u32((ebx + 0xa4) >>> 0) >>> 0 : 0
  if (ebx === 0 || pHoverMsg === 0) {
    const pPkt = k2W5B2StackPtr
    k2W5B2StackPtr = (k2W5B2StackPtr + 8) >>> 0
    try {
      const dwUnitId = ebx !== 0 ? m.u32((ebx + 0x0c) >>> 0) >>> 0 : 0xffffffff
      const bType = ebx !== 0 ? m.u8(ebx) : 6
      m.setU8(pPkt, 0x76)
      m.setU8((pPkt + 1) >>> 0, bType)
      m.setU32((pPkt + 2) >>> 0, dwUnitId)
      NET_QueuePacketToClientBuffer113c(m, esiClient, 1, pPkt, 6)
    } finally {
      k2W5B2StackPtr = pPkt
    }
    return
  }
  if (esiClient === 0) {
    throw new D2CommonAssertError('pClient', 0x996)
  }
  const ediPlayer = CLIENTS_GetPlayerUnit113c(m, esiClient, 0) >>> 0
  if (ediPlayer !== 0 && m.u32(ebx) === 0) {
    if (PARTY_TestPlayerRelationFlags113c(m, ediPlayer, ebx, 4) !== 0) {
      return
    }
    if (PARTY_TestPlayerRelationFlags113c(m, ebx, ediPlayer, 2) !== 0) {
      return
    }
  }
  const pChat = k2W5B2StackPtr
  k2W5B2StackPtr = (k2W5B2StackPtr + 0x120) >>> 0
  try {
    for (let off = 0; off < 0x120; off += 4) {
      m.setU32((pChat + off) >>> 0, 0)
    }
    const dwUnitId = m.u32((ebx + 0x0c) >>> 0) >>> 0
    const bType = m.u8(ebx)
    const bUsed = CHAT_GetUsed113c(m, pHoverMsg) & 0xff
    m.setU8(pChat, 0x26)
    m.setU8((pChat + 1) >>> 0, 0x05)
    m.setU8((pChat + 2) >>> 0, bUsed)
    m.setU8((pChat + 3) >>> 0, bType)
    m.setU32((pChat + 4) >>> 0, dwUnitId)
    m.setU8((pChat + 0x0a) >>> 0, 0)
    CHAT_CopyHoverMsg113c(m, pHoverMsg, (pChat + 0x1a) >>> 0)
    NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pChat, esiClient)
  } finally {
    k2W5B2StackPtr = pChat
  }
}

function netSendPacket9D_ItemActionOwned_6FCAB0F0(
  m: D2KernMemory113c,
  bAction: number,
  pOwnerUnit: number,
  pItem: number,
  pClient: number,
  nCommandFlagsMask: number,
  bSendSockets: number,
): void {
  const owner = pOwnerUnit >>> 0
  const item = pItem >>> 0
  const client = pClient >>> 0
  if (client === 0 || item === 0 || owner === 0 || m.u32(item) !== 4) {
    return
  }
  const pItemData = m.u32((item + 0x14) >>> 0) >>> 0
  if (pItemData === 0) {
    return
  }
  let nFlags = m.u32((pItemData + 0x18) >>> 0) | 0
  const dwExtraMask = nCommandFlagsMask >>> 0
  if (dwExtraMask !== 0) {
    nFlags = (nFlags | dwExtraMask) | 0
  }
  const nCmdFlags = ITEMS_GetCommandFlags113c(m, item) & 0xffff
  ITEMS_SetOrClearCommandFlags113c(m, item, nCmdFlags, 0)

  withK2W5B2Stack113c(m, 0x110, (pPkt) => {
    m.setU8(pPkt, 0x9d)
    m.setU8((pPkt + 0x01) >>> 0, bAction & 0xff)
    m.setU8((pPkt + 0x03) >>> 0, m.u8((pItemData + 0x44) >>> 0))
    m.setU32((pPkt + 0x04) >>> 0, m.u32((item + 0x0c) >>> 0) >>> 0)
    m.setU8((pPkt + 0x08) >>> 0, m.u32(owner) & 0xff)
    m.setU32((pPkt + 0x09) >>> 0, m.u32((owner + 0x0c) >>> 0) >>> 0)

    const bEquipLoc =
      INVENTORY_GetItemEquipLocation113c(m, m.u32((owner + 0x60) >>> 0) >>> 0, item) & 0xff
    if (bEquipLoc !== 0 && (nFlags & 0x04) !== 0) {
      nFlags = (nFlags ^ 0x04) | 0x40000
    }
    m.setU32((pPkt + 0x0d) >>> 0, nFlags >>> 0)

    const nSerializedBytes =
      ITEMS_SerializeItemToBuffer113c(m, item, (pPkt + 0x11) >>> 0, 0xf3, 1, 0, 0) | 0
    const nTotalLen = (nSerializedBytes + 0x11) | 0
    if (nTotalLen >= 0xf4) {
      throw new D2CommonAssertError('SUnitMsg.cpp', 0x68c)
    }
    m.setU8((pPkt + 0x02) >>> 0, nTotalLen & 0xff)
    NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt, nTotalLen)
  })
  if ((bSendSockets & 0xff) !== 0) {
    ITEMS_SyncSocketedSubItemsToClient113c(m, client, item, nFlags >>> 0)
  }
}

function withK2W5B2Stack113c<T>(m: D2KernMemory113c, size: number, fn: (pBuf: number) => T): T {
  const aligned = ((size + 15) & ~15) >>> 0
  const pBuf = k2W5B2StackPtr >>> 0
  k2W5B2StackPtr = (pBuf + aligned) >>> 0
  try {
    m.fill(pBuf, aligned, 0)
    return fn(pBuf)
  } finally {
    k2W5B2StackPtr = pBuf
  }
}

function netSendPacket75_PartyUnitRosterUpdate_6FCAD120(
  m: D2KernMemory113c,
  pTargetPlayer: number,
  pRecipientPlayer: number,
): number {
  void NET_ShouldSyncTrackedStatDelta_6FCAA330_113c
  let pClient = 0
  if (pRecipientPlayer !== 0 && m.u32(pRecipientPlayer >>> 0) === 0) {
    const pRecipData0 = UNITS_GetPlayerData113c(m, pRecipientPlayer >>> 0) >>> 0
    pClient = m.u32((pRecipData0 + 0x9c) >>> 0) >>> 0
  }
  return withK2W5B2Stack113c(m, 0x10, (pPkt) => {
    m.setU8(pPkt, 0x75)
    const dwTargetGuid =
      pTargetPlayer !== 0 ? m.u32((pTargetPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt + 0x01) >>> 0, dwTargetGuid)
    const wLevel = STATLIST_GetUnitStat113c(m, pTargetPlayer >>> 0, 0x0c, 0) & 0xffff
    m.setU16((pPkt + 0x07) >>> 0, wLevel)
    let wPartyId = 0xffff
    if (pTargetPlayer !== 0) {
      const pGame = m.u32((pTargetPlayer + 0x80) >>> 0) >>> 0
      if (pGame !== 0 && m.u32(pTargetPlayer >>> 0) === 0) {
        wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pTargetPlayer >>> 0, pGame) & 0xffff
      }
    }
    m.setU16((pPkt + 0x05) >>> 0, wPartyId)
    const pRecipData = UNITS_GetPlayerData113c(m, pRecipientPlayer >>> 0) >>> 0
    let pRelNode = 0
    if ((pRecipientPlayer >>> 0) !== (pTargetPlayer >>> 0) && pRecipData !== 0) {
      let pCur = m.u32((pRecipData + 0x38) >>> 0) >>> 0
      while (pCur !== 0) {
        if (m.u32(pCur) === dwTargetGuid) {
          pRelNode = pCur
          break
        }
        pCur = m.u32((pCur + 0x10) >>> 0) >>> 0
      }
    }
    const wRelFlags =
      (pRecipientPlayer >>> 0) !== (pTargetPlayer >>> 0) && pRelNode !== 0
        ? m.u16((pRelNode + 0x04) >>> 0)
        : 0
    m.setU16((pPkt + 0x09) >>> 0, wRelFlags)
    const wRelState =
      PARTY_GetPlayerRelationState113c(m, pRecipientPlayer >>> 0, pTargetPlayer >>> 0) & 0xffff
    m.setU16((pPkt + 0x0b) >>> 0, wRelState)
    return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x0d) | 0
  })
}

function inventoryFreeAllItems_6FCAF470(
  m: D2KernMemory113c,
  pInventory: number,
  pGame: number,
): void {
  INVENTORY_FreeAllItems_6FCAF470_113c(m, pInventory, pGame)
}

/**
 * [21/45] Sends owned-item action `0x05` packet (`0x9D`) for `pItem` (`eax`) on `pOwnerUnit` (`edi`)
 * to `pClient` (`ebx`), asserting `pClient` matches `pOwnerUnit`'s client and temporarily swapping
 * `InvPage` to `ITEMS_GetNodePage113c`.
 *
 * @va D2Game:0x6FCAC810
 */
export function NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(
  m: D2KernMemory113c,
  pItem: number,
  pOwnerUnit: number,
  pClient: number,
  nCommandFlagsMask: number,
): void {
  hitD2GameVa113c(0x6FCAC810)
  const item = pItem >>> 0
  const owner = pOwnerUnit >>> 0
  const client = pClient >>> 0
  let pOwnerClient = 0
  if (owner !== 0 && m.u32(owner) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, owner) >>> 0
    pOwnerClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  if (pOwnerClient !== client) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x802)
  }
  const bSavedInvPage = ITEMS_GetInvPage113c(m, item) & 0xff
  const bNodePage = ITEMS_GetNodePage113c(m, item) & 0xff
  ITEMS_SetInvPage113c(m, item, bNodePage)
  if (m.u32(0x6fde9e1c) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(
      m,
      0x05,
      owner,
      item,
      client,
      nCommandFlagsMask >>> 0,
      0,
    )
  } else {
    netSendPacket9D_ItemActionOwned_6FCAB0F0(
      m,
      0x05,
      owner,
      item,
      client,
      nCommandFlagsMask >>> 0,
      0,
    )
  }
  ITEMS_SetInvPage113c(m, item, bSavedInvPage)
}

/**
 * [22/45] Queues 26-byte (`0x1A`) packet `0x59` (assign player unit, class, name, and coords)
 * to `pClient` (`eax`), then locates player `dwPlayerGuid` (`edi`) in the game player hash table
 * and sends party roster packet `0x75` (`0x6FCAD120`).
 *
 * @va D2Game:0x6FCAD710
 */
export function NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(
  m: D2KernMemory113c,
  pClient: number,
  bCharClass: number,
  dwPlayerGuid: number,
  szCharName: number,
  wPosX: number,
  wPosY: number,
): void {
  hitD2GameVa113c(0x6FCAD710)
  const client = pClient >>> 0
  withK2W5B2Stack113c(m, 0x20, (pPkt) => {
    for (let i = 0; i < 0x1a; i += 1) {
      m.setU8((pPkt + i) >>> 0, 0)
    }
    m.setU8(pPkt, 0x59)
    m.setU32((pPkt + 0x01) >>> 0, dwPlayerGuid >>> 0)
    m.setU8((pPkt + 0x05) >>> 0, bCharClass & 0xff)
    if ((szCharName >>> 0) !== 0) {
      for (let i = 0; i < 16; i += 1) {
        const ch = m.u8(((szCharName >>> 0) + i) >>> 0)
        m.setU8((pPkt + 0x06 + i) >>> 0, ch)
        if (ch === 0) {
          break
        }
      }
      m.setU8((pPkt + 0x15) >>> 0, 0)
    }
    m.setU16((pPkt + 0x16) >>> 0, wPosX & 0xffff)
    m.setU16((pPkt + 0x18) >>> 0, wPosY & 0xffff)
    NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt, 0x1a)
  })

  if (client === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0xfb)
  }
  let pRecipientPlayer = 0
  if ((m.u8((client + 0x3d4) >>> 0) & 0x01) !== 0) {
    pRecipientPlayer = m.u32((client + 0x174) >>> 0) >>> 0
  } else if (m.u32((client + 0x174) >>> 0) !== 0) {
    const pResolved =
      SUNIT_GetServerUnit113c(
        m,
        m.u32((client + 0x1a8) >>> 0) >>> 0,
        m.u32((client + 0x16c) >>> 0) >>> 0,
        m.u32((client + 0x170) >>> 0) >>> 0,
      ) >>> 0
    if (pResolved === 0) {
      m.setU32((client + 0x174) >>> 0, 0)
    }
    pRecipientPlayer = pResolved
  }

  const pGame = m.u32((client + 0x1a8) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x2d3)
  }
  const bucketIdx = (dwPlayerGuid >>> 0) & 0x7f
  let pTargetPlayer = m.u32((pGame + 0x1120 + bucketIdx * 4) >>> 0) >>> 0
  while (pTargetPlayer !== 0) {
    if ((m.u32((pTargetPlayer + 0x0c) >>> 0) >>> 0) === (dwPlayerGuid >>> 0)) {
      NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, pTargetPlayer, pRecipientPlayer)
      return
    }
    pTargetPlayer = m.u32((pTargetPlayer + 0xe4) >>> 0) >>> 0
  }
}

/**
 * [23/45] Dispatches unit stat delta sync checks for `pUnit` (`eax`) relative to `pPlayer` (`ecx`):
 * routes player units (`type == 0`) to `0x6FCAC910` and monster units (`type == 1`) to `0x6FCAD500`.
 *
 * @va D2Game:0x6FCAE110
 */
export function NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pPlayer: number,
  nNewVal: number,
  nStatSlot: number,
): number {
  hitD2GameVa113c(0x6FCAE110)
  const player = pPlayer >>> 0
  if (player === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x712)
  }
  const unit = pUnit >>> 0
  if (unit === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x713)
  }
  const dwType = m.u32(unit) >>> 0
  if (dwType === 0) {
    return NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c(m, player, unit, nNewVal | 0, nStatSlot | 0) | 0
  }
  if (dwType === 1) {
    return MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c(m, unit, nNewVal | 0, player) | 0
  }
  return 0
}

/**
 * [24/45] Unlinks and frees `pPlayer` (`ecx`)'s per-player NPC gamble inventory node from
 * the NPC control record matching `pNpcRecord` (`eax`) in `pGame` (`ebx`).
 *
 * @va D2Game:0x6FCAF620
 */
export function NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c(
  m: D2KernMemory113c,
  pNpcRecord: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCAF620)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    let npcRec = pNpcRecord >>> 0
    const player = pPlayer >>> 0
    const game = pGame >>> 0
    if (npcRec !== 0 && (m.u32(npcRec) >>> 0) !== 1 && game !== 0) {
      for (let b = 0; b < 128; b += 1) {
        let pMon = m.u32((game + 0x1320 + b * 4) >>> 0) >>> 0
        while (pMon !== 0) {
          const pMonData = m.u32((pMon + 0x14) >>> 0) >>> 0
          if (pMonData !== 0 && (m.u32((pMonData + 0x30) >>> 0) >>> 0) === npcRec) {
            npcRec = pMon
            b = 128
            break
          }
          pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
        }
      }
    }
    const dwNpcClassId = npcRec !== 0 ? m.u32((npcRec + 0x04) >>> 0) >>> 0 : 0xffffffff
    const pOutIdx = allocW5B2Stack(m, 4) >>> 0
    const pSlot = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutIdx, game, dwNpcClassId) >>> 0
    const dwPlayerGuid = player !== 0 ? m.u32((player + 0x0c) >>> 0) >>> 0 : 0xffffffff
    if (pSlot === 0 || m.u32((pSlot + 0x0c) >>> 0) === 0) {
      return
    }
    let pNode = m.u32((pSlot + 0x08) >>> 0) >>> 0
    let pPrev = 0
    while (pNode !== 0) {
      if ((m.u32((pNode + 0x04) >>> 0) >>> 0) === dwPlayerGuid) {
        if (pPrev !== 0) {
          m.setU32((pPrev + 0x08) >>> 0, m.u32((pNode + 0x08) >>> 0) >>> 0)
        } else {
          m.setU32((pSlot + 0x08) >>> 0, m.u32((pNode + 0x08) >>> 0) >>> 0)
        }
        const pInv = m.u32(pNode) >>> 0
        if (pInv !== 0) {
          inventoryFreeAllItems_6FCAF470(m, pInv, game)
          INVENTORY_FreeInventory113c(m, m.u32(pNode) >>> 0)
          m.setU32(pNode, 0)
        }
        void m.u32((game + 0x1c) >>> 0)
        return
      }
      pPrev = pNode
      pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
    }
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * [25/45] Unlinks and frees both `pPlayer` (`ecx`)'s gamble inventory node (`+0x08`) and
 * mercenary-hire list node (`+0x18`) from the NPC control record matching `pNpcRecord` (`eax`).
 *
 * @va D2Game:0x6FCAFAF0
 */
export function NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c(
  m: D2KernMemory113c,
  pNpcRecord: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCAFAF0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    let npcRec = pNpcRecord >>> 0
    const player = pPlayer >>> 0
    const game = pGame >>> 0
    if (npcRec !== 0 && (m.u32(npcRec) >>> 0) !== 1 && game !== 0) {
      for (let b = 0; b < 128; b += 1) {
        let pMon = m.u32((game + 0x1320 + b * 4) >>> 0) >>> 0
        while (pMon !== 0) {
          const pMonData = m.u32((pMon + 0x14) >>> 0) >>> 0
          if (pMonData !== 0 && (m.u32((pMonData + 0x30) >>> 0) >>> 0) === npcRec) {
            npcRec = pMon
            b = 128
            break
          }
          pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
        }
      }
    }
    const dwNpcClassId = npcRec !== 0 ? m.u32((npcRec + 0x04) >>> 0) >>> 0 : 0xffffffff
    const pOutIdx = allocW5B2Stack(m, 4) >>> 0
    const pSlot = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutIdx, game, dwNpcClassId) >>> 0
    if (pSlot === 0) {
      return
    }
    const dwPlayerGuid = player !== 0 ? m.u32((player + 0x0c) >>> 0) >>> 0 : 0xffffffff
    if (m.u32((pSlot + 0x0c) >>> 0) !== 0) {
      let pNode = m.u32((pSlot + 0x08) >>> 0) >>> 0
      let pPrev = 0
      while (pNode !== 0) {
        if ((m.u32((pNode + 0x04) >>> 0) >>> 0) === dwPlayerGuid) {
          if (pPrev !== 0) {
            m.setU32((pPrev + 0x08) >>> 0, m.u32((pNode + 0x08) >>> 0) >>> 0)
          } else {
            m.setU32((pSlot + 0x08) >>> 0, m.u32((pNode + 0x08) >>> 0) >>> 0)
          }
          const pInv = m.u32(pNode) >>> 0
          if (pInv !== 0) {
            inventoryFreeAllItems_6FCAF470(m, pInv, game)
            INVENTORY_FreeInventory113c(m, m.u32(pNode) >>> 0)
            m.setU32(pNode, 0)
          }
          void m.u32((game + 0x1c) >>> 0)
          break
        }
        pPrev = pNode
        pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
      }
    }
    let pMercNode = m.u32((pSlot + 0x18) >>> 0) >>> 0
    let pMercPrev = 0
    while (pMercNode !== 0) {
      if ((m.u32(pMercNode) >>> 0) === dwPlayerGuid) {
        if (pMercPrev !== 0) {
          m.setU32((pMercPrev + 0x08) >>> 0, m.u32((pMercNode + 0x08) >>> 0) >>> 0)
        } else {
          m.setU32((pSlot + 0x18) >>> 0, m.u32((pMercNode + 0x08) >>> 0) >>> 0)
        }
        void m.u32((game + 0x1c) >>> 0)
        return
      }
      pMercPrev = pMercNode
      pMercNode = m.u32((pMercNode + 0x08) >>> 0) >>> 0
    }
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

function statesClearSameGroupStatesOnUnit_6FCBEA30(
  m: D2KernMemory113c,
  pUnit: number,
  nStateId: number,
  bIncludeTargetState: number,
): number {
  const targetState = nStateId | 0
  if (targetState < 0) return 0
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  if (targetState >= nStatesCount) return 0
  const pStatesBase = m.u32((pDataTables + 0xbc) >>> 0) >>> 0
  const pTargetStateTxt = (pStatesBase + imul32(targetState, 0x3c)) >>> 0
  if (pTargetStateTxt === 0) return 0
  const wGroup = (m.u16((pTargetStateTxt + 0x1e) >>> 0) << 16) >> 16
  if (wGroup === 0) return 0

  let bRemovedAny = 0
  for (let curState = 0; curState < nStatesCount; curState += 1) {
    if (curState !== targetState || (bIncludeTargetState | 0) !== 0) {
      const pCurStateTxt = (pStatesBase + imul32(curState, 0x3c)) >>> 0
      const curGroup = (m.u16((pCurStateTxt + 0x1e) >>> 0) << 16) >> 16
      if (curGroup === wGroup) {
        if ((STATES_CheckState113c(m, pUnit >>> 0, curState) | 0) !== 0) {
          bRemovedAny = 1
          STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, curState, 0)
          const pStatList =
            STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, curState) >>> 0
          if (pStatList !== 0) {
            STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pStatList)
            STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
          }
        }
      }
    }
  }
  return bRemovedAny
}

function skillsRollAndAddSkillElemDamage_6FCBF210(
  m: D2KernMemory113c,
  nSkillId: number,
  pAttacker: number,
  pDmg: number,
  nSkillLevel: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsCount) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const lvl = nSkillLevel | 0
  const nLength = SKILLS_GetSkillPeriodicDelayOrLength113c(m, pAttacker >>> 0, skillId, lvl, 1) | 0
  const nMinElem = SKILLS_GetSkillElemMinDamage113c(m, pAttacker >>> 0, skillId, lvl, 1) | 0
  const nMaxElem = SKILLS_GetSkillElemMaxDamage113c(m, pAttacker >>> 0, skillId, lvl, 1) | 0
  const nRange = (nMaxElem - nMinElem) | 0
  const nRoll = SEED_RollLimitedFast113c(m, (pAttacker + 0x20) >>> 0, nRange) | 0
  const nDamage256 = (nRoll + nMinElem) | 0
  const eElemType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
  SUNITDMG_AddElementalDamageToStruct113c(
    m,
    pDmg >>> 0,
    eElemType,
    pAttacker >>> 0,
    nDamage256,
    nLength,
    0,
    0,
  )
  return nDamage256
}

/**
 * [26/45] Frees all gamble inventories (`+0x08`), the main vendor inventory (`+0x04`),
 * and any unsold quest/unique item nodes (`+0x14`, removing cursor/inventory references
 * from all living players when `dwFlag (+0x0C) == 1`) on `pNpcSlot` (`[esp+4]`).
 *
 * @va D2Game:0x6FCB0170
 */
export function NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c(
  m: D2KernMemory113c,
  pGame: number,
  pNpcSlot: number,
): void {
  hitD2GameVa113c(0x6FCB0170)
  const game = pGame >>> 0
  const slot = pNpcSlot >>> 0
  if (m.u32((slot + 0x0c) >>> 0) !== 0) {
    let pGambleNode = m.u32((slot + 0x08) >>> 0) >>> 0
    while (pGambleNode !== 0) {
      const pInv = m.u32(pGambleNode) >>> 0
      const pNext = m.u32((pGambleNode + 0x08) >>> 0) >>> 0
      if (pInv !== 0) {
        inventoryFreeAllItems_6FCAF470(m, pInv, game)
        INVENTORY_FreeInventory113c(m, m.u32(pGambleNode) >>> 0)
        m.setU32(pGambleNode, 0)
      }
      void m.u32((game + 0x1c) >>> 0)
      pGambleNode = pNext
    }
    m.setU32((slot + 0x08) >>> 0, 0)
  }

  inventoryFreeAllItems_6FCAF470(m, m.u32((slot + 0x04) >>> 0) >>> 0, game)
  INVENTORY_FreeInventory113c(m, m.u32((slot + 0x04) >>> 0) >>> 0)
  m.setU32((slot + 0x04) >>> 0, 0)

  let pQuestNode = m.u32((slot + 0x14) >>> 0) >>> 0
  while (pQuestNode !== 0) {
    const pNext = m.u32((pQuestNode + 0x10) >>> 0) >>> 0
    if ((m.u32((pQuestNode + 0x0c) >>> 0) | 0) === 1) {
      const pItem = m.u32(pQuestNode) >>> 0
      if (pItem !== 0) {
        D2GAME_SUNIT_IterateAllLivingPlayers113c(
          m,
          game,
          (mem, _g, pPlayer, pArg) => {
            ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlayer, pArg)
          },
          pItem,
        )
        SUNIT_FreeUnit113c(m, game, pItem)
      }
    }
    void m.u32((game + 0x1c) >>> 0)
    pQuestNode = pNext
  }
  m.setU32((slot + 0x14) >>> 0, 0)
}

/**
 * [27/45] Applies progressive elemental charge-up damage and physical-to-elemental conversion
 * from `pStatList` (`[esp+0x0C]`) onto `pDmg` (`[esp+0x08]`) for `pAttacker` (`[esp+0x04]`).
 *
 * @va D2Game:0x6FCB18D0
 */
export function SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDmg: number,
  pStatList: number,
): void {
  hitD2GameVa113c(0x6FCB18D0)
  const attacker = pAttacker >>> 0
  const dmg = pDmg >>> 0
  const statList = pStatList >>> 0
  const nSkillId = STATLIST_GetStatValue113c(m, statList, 0x15e, 0) | 0
  if (nSkillId < 0) return
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (nSkillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return

  let nSkillLevel = STATLIST_GetStatValue113c(m, statList, 0x15f, 0) | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, attacker, nSkillId) >>> 0
  const nUnitLvl = SKILLS_EvaluateSkillLevel113c(m, attacker, pSkill, 1) | 0
  if (nUnitLvl > nSkillLevel) {
    nSkillLevel = nUnitLvl
  }
  if (nSkillLevel <= 0) return

  const wAuraStat1 = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
  if (wAuraStat1 < 0) return
  if (wAuraStat1 >= (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) return
  const nCharges = STATLIST_GetStatValue113c(m, statList, wAuraStat1, 0) | 0
  if (nCharges <= 0) return

  skillsRollAndAddSkillElemDamage_6FCBF210(m, nSkillId, attacker, dmg, nSkillLevel)
  if (m.u8((pSkillsTxt + 0x1dc) >>> 0) === 4 && nCharges === 3) {
    const nParam5 = SKILLS_GetParam5Fast_6FC21C50_113c(m, nSkillId) | 0
    if (nParam5 !== 0) {
      const nColdLen = m.u32((dmg + 0x30) >>> 0) | 0
      const nFreezeAdd = sdiv32(nColdLen, nParam5) | 0
      m.setU32((dmg + 0x34) >>> 0, ((m.u32((dmg + 0x34) >>> 0) | 0) + nFreezeAdd) >>> 0)
    }
  }
  m.setU8((dmg + 0x05) >>> 0, (m.u8((dmg + 0x05) >>> 0) | 0x40) & 0xff)

  const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
  let nConvPct = SKILLS_EvalCalcByOffset113c(m, attacker, dwCalc1, nSkillId, nSkillLevel) | 0
  if (nConvPct > 0) {
    if (nConvPct >= 100) {
      nConvPct = 100
    }
    const nPhysDmg = m.u32((dmg + 0x08) >>> 0) | 0
    let nConverted = mulDiv113c(nPhysDmg, nConvPct, 100) | 0
    if (nConverted >= nPhysDmg) {
      nConverted = nPhysDmg
    }
    m.setU32((dmg + 0x08) >>> 0, (nPhysDmg - nConverted) >>> 0)
    SUNITDMG_AddElementalDamageToStruct113c(
      m,
      dmg,
      m.u8((pSkillsTxt + 0x1dc) >>> 0),
      attacker,
      nConverted,
      0,
      0,
      0,
    )
  }
}

/**
 * [28/45] Applies progressive elemental charge-up damage (and stage 2..3 cold-to-freeze length
 * bonus via `dwParam2`) from `pStatList` (`[esp+0x08]`) onto `pDmg` (`[esp+0x0C]`).
 *
 * @va D2Game:0x6FCB1A30
 */
export function SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pStatList: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCB1A30)
  const attacker = pAttacker >>> 0
  const statList = pStatList >>> 0
  const dmg = pDmg >>> 0
  const nSkillId = STATLIST_GetStatValue113c(m, statList, 0x15e, 0) | 0
  if (nSkillId < 0) return
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (nSkillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return

  let nSkillLevel = STATLIST_GetStatValue113c(m, statList, 0x15f, 0) | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, attacker, nSkillId) >>> 0
  const nUnitLvl = SKILLS_EvaluateSkillLevel113c(m, attacker, pSkill, 1) | 0
  if (nUnitLvl > nSkillLevel) {
    nSkillLevel = nUnitLvl
  }
  if (nSkillLevel <= 0) return

  const wAuraStat1 = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
  if (wAuraStat1 < 0) return
  if (wAuraStat1 >= (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) return
  const nCharges = STATLIST_GetStatValue113c(m, statList, wAuraStat1, 0) | 0
  if (nCharges <= 0) return

  skillsRollAndAddSkillElemDamage_6FCBF210(m, nSkillId, attacker, dmg, nSkillLevel)
  if (m.u8((pSkillsTxt + 0x1dc) >>> 0) === 4 && nCharges >= 2 && nCharges <= 3) {
    const nParam2 = SKILLS_GetParam2Fast_6FC21BC0_113c(m, nSkillId) | 0
    if (nParam2 !== 0) {
      const nColdLen = m.u32((dmg + 0x30) >>> 0) | 0
      const nFreezeAdd = sdiv32(nColdLen, nParam2) | 0
      m.setU32((dmg + 0x34) >>> 0, ((m.u32((dmg + 0x34) >>> 0) | 0) + nFreezeAdd) >>> 0)
    }
  }
  m.setU8((dmg + 0x05) >>> 0, (m.u8((dmg + 0x05) >>> 0) | 0x40) & 0xff)
}

/**
 * [29/45] Starts a self-buff aura state (`pSkillsTxt->wAuraState`) on `pUnit` (`edx`) when
 * `SKILLS_ResolveChargedSrvMissileId113c(nSkillId, pUnit) > 0`, clearing same-group states
 * and applying `SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c`.
 *
 * @va D2Game:0x6FCB20C0
 */
export function SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB20C0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    void pGame
    const unit = pUnit >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0
    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    if (SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, skillId) === 0) {
      return 0
    }
    if ((SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0) <= 0) {
      return 0
    }
    const dwLenCalc = m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0
    if ((SKILLS_EvalCalcByOffset113c(m, unit, dwLenCalc, skillId, skillLevel) | 0) <= 0) {
      return 0
    }
    const wAuraState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
    if (wAuraState < 0 || wAuraState >= (m.u32((pDataTables + 0xc4) >>> 0) | 0)) {
      return 0
    }
    statesClearSameGroupStatesOnUnit_6FCBEA30(m, unit, wAuraState, 0)

    const nDuration =
      SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0, skillId, skillLevel) | 0
    const pSetup = allocW5B2Stack(m, 0x24) >>> 0
    m.setU32(pSetup, unit)
    m.setU32((pSetup + 0x04) >>> 0, unit)
    m.setU32((pSetup + 0x08) >>> 0, skillId >>> 0)
    m.setU32((pSetup + 0x0c) >>> 0, skillLevel >>> 0)
    m.setU32((pSetup + 0x10) >>> 0, nDuration >>> 0)
    m.setU32((pSetup + 0x14) >>> 0, 0xffffffff)
    m.setU32((pSetup + 0x18) >>> 0, 0)
    m.setU32((pSetup + 0x1c) >>> 0, wAuraState >>> 0)
    m.setU32((pSetup + 0x20) >>> 0, 0)

    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pSetup) >>> 0
    if (pStatList === 0) {
      return 0
    }
    SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, unit, pStatList, skillId, skillLevel)
    STATLIST_SetStat113c(m, pStatList, 0x15e, skillId, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15f, skillLevel, 0)
    STATES_ClearGfxStateFlag113c(m, unit, wAuraState, 1)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * [30/45] Executes direct skill physical + elemental damage and knockback roll against
 * `pAttacker` (`edx`)'s path target in `pGame` (`ecx`) after validating via `0x6FCB2060`.
 *
 * @va D2Game:0x6FCB2770
 */
export function SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB2770)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const attacker = pAttacker >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0
    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    if (
      (SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c(
        m,
        game,
        attacker,
        skillId,
        skillLevel,
      ) |
        0) ===
      0
    ) {
      return 0
    }
    SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
    let pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
    if (pTarget === attacker) {
      pTarget = 0
    }

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 28; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, attacker, skillId, pDmg, skillLevel)
    skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, attacker, pDmg, skillLevel)
    SUNITDMG_ApplyDamage113c(m, game, attacker, pTarget, pDmg)
    m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 0x01) & 0xff)

    const nLvlA = STATLIST_GetUnitStat113c(m, pTarget, 0x0c, 0) | 0
    const nLvlB = STATLIST_GetUnitStat113c(m, pTarget, 0x0c, 0) | 0
    let nEffectiveLvl = (nLvlA + skillLevel - nLvlB) | 0
    if (nEffectiveLvl <= 1) {
      nEffectiveLvl = 1
    }
    if (nEffectiveLvl >= skillLevel) {
      nEffectiveLvl = skillLevel
    }

    let dwCalcOffset = 0
    if ((pTarget !== 0 && m.u32(pTarget) === 0) || (MONSTERS_GetHirelingTypeId113c(m, pTarget) | 0) !== 0) {
      dwCalcOffset = m.u32((pSkillsTxt + 0x144) >>> 0) >>> 0
    } else if ((MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pTarget) | 0) !== 0) {
      dwCalcOffset = m.u32((pSkillsTxt + 0x140) >>> 0) >>> 0
    } else if ((MONSTER_CheckTypeFlagsMask113c(m, pTarget, 0x08) | 0) !== 0) {
      dwCalcOffset = m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0
    } else {
      dwCalcOffset = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
    }

    const nKnockbackChance =
      SKILLS_EvalCalcByOffset113c(m, attacker, dwCalcOffset, skillId, nEffectiveLvl) | 0
    if (nKnockbackChance > 0) {
      const nRoll = SEED_RollLimitedFast113c(m, (attacker + 0x20) >>> 0, 100) | 0
      if (nRoll < nKnockbackChance) {
        m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 0x08) & 0xff)
      }
    }
    if (((STATLIST_GetUnitStat113c(m, pTarget, 0x06, 0) >>> 0) & 0xffffff00) === 0) {
      m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 0x02) & 0xff)
    }
    SUNITDMG_ApplySideEffectsAndKill113c(m, game, attacker, pTarget, pDmg)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

function skillsRollAvoidAndApplySkillDamage_6FCC10B0(
  m: D2KernMemory113c,
  pAttacker: number,
  pDmg: number,
  pGame: number,
  pDefender: number,
): void {
  let pOwner = pAttacker >>> 0
  const dmg = pDmg >>> 0
  const game = pGame >>> 0
  const defender = pDefender >>> 0
  if (pOwner === 0 || defender === 0) {
    return
  }
  if (m.u32(pOwner) === 3) {
    const pResolved = SUNIT_GetOwnerUnit113c(m, pOwner, game) >>> 0
    if (pResolved !== 0) {
      pOwner = pResolved
    }
  }
  if (m.u16((dmg + 0x04) >>> 0) === 0) {
    return
  }
  const nAvoidFlags = SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pOwner, defender, dmg) | 0
  if ((nAvoidFlags & 0x02) !== 0) {
    m.setU8((dmg + 0x05) >>> 0, (m.u8((dmg + 0x05) >>> 0) | 0x01) & 0xff)
  }
  if ((nAvoidFlags & 0x04) !== 0) {
    m.setU8((dmg + 0x04) >>> 0, (m.u8((dmg + 0x04) >>> 0) | 0x80) & 0xff)
  }
  if ((nAvoidFlags & 0x10) !== 0) {
    m.setU8((dmg + 0x05) >>> 0, (m.u8((dmg + 0x05) >>> 0) | 0x80) & 0xff)
  }
  if ((nAvoidFlags & 0x01) !== 0) {
    m.setU8((dmg + 0x04) >>> 0, (m.u8((dmg + 0x04) >>> 0) | 0x10) & 0xff)
  }
  if (nAvoidFlags !== 0) {
    m.setU8((dmg + 0x04) >>> 0, (m.u8((dmg + 0x04) >>> 0) & 0xfe) & 0xff)
  }
  if ((m.u8((dmg + 0x04) >>> 0) & 0x01) !== 0) {
    if ((STATES_CheckState113c(m, defender, 0x36) | 0) === 0) {
      m.setU8((dmg + 0x04) >>> 0, (m.u8((dmg + 0x04) >>> 0) | 0x04) & 0xff)
    }
  }
  MONSTER_ApplyCritDamage113c(m, pOwner, dmg, defender)
  if ((m.u8((dmg + 0x04) >>> 0) & 0x01) !== 0) {
    SUNITDMG_ApplyDamage113c(m, game, pOwner, defender, dmg, 1, undefined, 1)
  }
  SUNITDMG_ApplySideEffectsAndKill113c(m, game, pOwner, defender, dmg)
}

function skillsEvalChargeScaledCalcByStage_6FCB1240(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if ((m.u8((pSkillsTxt + 0x04) >>> 0) & 0x04) !== 0) {
    const nAuraState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
    if (nAuraState >= 0 && nAuraState < (m.u32((pDataTables + 0xc4) >>> 0) | 0)) {
      const nPassiveStat = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
      if (nPassiveStat >= 0 && nPassiveStat < (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) {
        const pStatList =
          STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, nAuraState) >>> 0
        if (pStatList === 0) {
          return (
            SKILLS_EvalCalcByOffset113c(
              m,
              pUnit >>> 0,
              m.u32((pSkillsTxt + 0x38) >>> 0) >>> 0,
              skillId,
              nLevel | 0,
            ) | 0
          )
        }
        let nStage = STATLIST_GetStatValue113c(m, pStatList, nPassiveStat, 0) | 0
        if (nStage <= 1) {
          nStage = 1
        } else if (nStage >= 3) {
          nStage = 3
        }
        const dwStageCalc = m.u32((pSkillsTxt + nStage * 4 + 0x34) >>> 0) >>> 0
        return SKILLS_EvalCalcByOffset113c(m, pUnit >>> 0, dwStageCalc, skillId, nLevel | 0) | 0
      }
    }
  }
  return (
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x38) >>> 0) >>> 0,
      skillId,
      nLevel | 0,
    ) | 0
  )
}

function skillsApplyRadialDamageCallback_6FCB3040(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  return SKILLS_ApplyRadialDamageCallback_6FCB3040_113c(m, pAuraCtx, pTargetUnit) | 0
}

function skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pOutX: number,
  pOutY: number,
): number {
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  let outY: number
  if (pTarget !== (pUnit >>> 0) && pTarget !== 0) {
    const uTypeX = m.u32(pTarget) | 0
    const pTargetPathX = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    let outX: number
    if (uTypeX === 2 || (uTypeX > 3 && uTypeX <= 5)) {
      outX = m.u32((pTargetPathX + 0x0c) >>> 0) | 0
    } else {
      outX = pTargetPathX !== 0 ? PATH_GetPosX113c(m, pTargetPathX) | 0 : 0
    }
    m.setU32(pOutX >>> 0, outX >>> 0)

    const uTypeY = m.u32(pTarget) | 0
    const pTargetPathY = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
      outY = m.u32((pTargetPathY + 0x10) >>> 0) | 0
    } else {
      outY = pTargetPathY !== 0 ? PATH_GetPosY113c(m, pTargetPathY) | 0 : 0
    }
  } else {
    const pUnitPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    const firstX = PATH_GetFirstPointX113c(m, pUnitPath) | 0
    m.setU32(pOutX >>> 0, firstX >>> 0)
    outY = PATH_GetFirstPointY113c(m, pUnitPath) | 0
  }
  m.setU32(pOutY >>> 0, outY >>> 0)
  return m.u32(pOutX >>> 0) !== 0 && m.u32(pOutY >>> 0) !== 0 ? 1 : 0
}

/**
 * [31/45] Rolls hit chance (`0x6FCFE5A0`), applies progressive attack rating, physical, and
 * elemental charge bonuses (`0x6FCB22A0`, `0x6FCBF210`, `0x6FCFD450`, `0x6FCB1E30`), and
 * allocates combat (`0x6FCFDDE0`) for `pAttacker` (`eax`) against `pTarget`.
 *
 * @va D2Game:0x6FCB2A60
 */
export function SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pGame: number,
  pTarget: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FCB2A60)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const attacker = pAttacker >>> 0
    const game = pGame >>> 0
    const target = pTarget >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0
    if (skillId < 0) return
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 28; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }

    const nSkillToHit = SKILLS_GetSkillToHitBonus113c(m, attacker, skillId, skillLevel) | 0
    const nPassiveToHit = STATLIST_GetUnitStat113c(m, attacker, 0x145, 0) | 0
    const nTotalToHit = (nSkillToHit + nPassiveToHit) | 0
    const wResultFlags =
      sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(m, target, attacker, game, nTotalToHit, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)

    if ((wResultFlags & 0x01) !== 0) {
      m.setU32(pDmg, (m.u32(pDmg) | 0x02) >>> 0)
      SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(m, attacker, pDmg)
      const nCalc1DmgPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, ((m.u32((pDmg + 0x0c) >>> 0) | 0) + nCalc1DmgPct) >>> 0)

      const bEType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
      if (bEType > 0) {
        const nConvPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            attacker,
            m.u32((pSkillsTxt + 0x144) >>> 0) >>> 0,
            skillId,
            skillLevel,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, nConvPct >>> 0)
        if (nConvPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, bEType)
        }
        skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, attacker, pDmg, skillLevel)
      }

      SUNITDMG_FillDamageValues113c(
        m,
        game,
        attacker,
        target,
        pDmg,
        0,
        m.u8((pSkillsTxt + 0x1a5) >>> 0),
      )
      SKILLS_ApplyProgressiveChargesToDamage113c(m, attacker, pDmg)
    }

    SUNITDMG_AllocCombat113c(m, game, attacker, target, pDmg, 0x80)
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * [32/45] Radial callback (`ecx = pAuraCtx`, `edx = pDefender`) that clones the `0x70`-byte
 * `D2DamageStrc` at `*(pAuraCtx + 0x0C)` and delegates to `0x6FCC10B0`.
 *
 * @va D2Game:0x6FCB2CC0
 */
export function SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pDefender: number,
): number {
  hitD2GameVa113c(0x6FCB2CC0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const ctx = pAuraCtx >>> 0
    const pSrcDmg = m.u32((ctx + 0x0c) >>> 0) >>> 0
    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, m.u32((pSrcDmg + i) >>> 0) >>> 0)
    }
    const pGame = m.u32(ctx) >>> 0
    const pAttacker = m.u32((ctx + 0x04) >>> 0) >>> 0
    skillsRollAvoidAndApplySkillDamage_6FCC10B0(m, pAttacker, pDmg, pGame, pDefender >>> 0)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * [33/45] Rolls skill physical + elemental damage into a template `D2DamageStrc` and dispatches
 * `AURA_ForEachUnitInRadius113c` with `0x6FCB3040` across the charge-scaled radius (`0x6FCB1240`
 * or `pSkillsTxt->dwAuraRangeCalc` at `+0x64`).
 *
 * @va D2Game:0x6FCB34A0
 */
export function SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB34A0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const attacker = pAttacker >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0
    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    let nRadius = skillsEvalChargeScaledCalcByStage_6FCB1240(m, attacker, skillId, skillLevel) | 0
    if (nRadius === 0) {
      nRadius =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x64) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
    }

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 28; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }
    m.setU32(pDmg, 0x02)
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, attacker, skillId, pDmg, skillLevel)
    skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, attacker, pDmg, skillLevel)
    const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
    if (dwHitClass !== 0) {
      m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
    }

    const pRadialArg = allocW5B2Stack(m, 0x14) >>> 0
    for (let i = 0; i < 5; i += 1) {
      m.setU32((pRadialArg + i * 4) >>> 0, 0)
    }
    m.setU32(pRadialArg, pDmg)
    const wResultFlags = m.u16((pSkillsTxt + 0x12e) >>> 0)
    m.setU16((pRadialArg + 0x08) >>> 0, wResultFlags)
    m.setU32((pRadialArg + 0x0c) >>> 0, m.u32((pSkillsTxt + 0x130) >>> 0) >>> 0)
    m.setU8((pRadialArg + 0x10) >>> 0, m.u8((pSkillsTxt + 0x1a5) >>> 0))
    if ((wResultFlags & 0x01) === 0) {
      const nToHit = SKILLS_GetSkillToHitBonus113c(m, attacker, skillId, skillLevel) | 0
      m.setU32((pRadialArg + 0x04) >>> 0, nToHit >>> 0)
    }

    AURA_ForEachUnitInRadius113c(
      m,
      game,
      attacker,
      0,
      0,
      nRadius,
      m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0,
      0x6fcb3040,
      pRadialArg,
      0,
      skillsApplyRadialDamageCallback_6FCB3040,
    )
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * [34/45] Spawns `nCount` (`[esp+0x14]`) server projectiles (`nMissileId`) from `pCaster`
 * (`[esp+0x08]`) toward its target/path coords with random `[-nSpread, +nSpread)` scatter
 * when `nCount > 1 && nSpread >= 2` (skipping tiles within squared distance `< 4` of caster).
 *
 * @va D2Game:0x6FCB3990
 */
export function SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCaster: number,
  nMissileId: number,
  pOwner: number,
  nCount: number,
  nSpread: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB3990)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const caster = pCaster >>> 0
    const owner = pOwner >>> 0
    const pCoords = allocW5B2Stack(m, 8) >>> 0
    const pOutX = pCoords
    const pOutY = (pCoords + 4) >>> 0
    if (skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, caster, game, pOutX, pOutY) === 0) {
      return 0
    }
    const targetX = m.u32(pOutX) | 0
    const targetY = m.u32(pOutY) | 0
    const pSeed = (caster + 0x20) >>> 0
    SEED_InitLowSeed113c(m, pSeed, targetX >>> 0)

    const pMissPkt = allocW5B2Stack(m, 0x5c) >>> 0
    for (let i = 0; i < 0x17; i += 1) {
      m.setU32((pMissPkt + i * 4) >>> 0, 0)
    }
    m.setU32(pMissPkt, 0x420)
    m.setU32((pMissPkt + 0x04) >>> 0, owner)
    m.setU32((pMissPkt + 0x08) >>> 0, caster)
    m.setU32((pMissPkt + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pMissPkt + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pMissPkt + 0x30) >>> 0, nSkillLevel >>> 0)

    const count = nCount | 0
    const spread = nSpread | 0
    if (count <= 1 || spread < 2) {
      m.setU32((pMissPkt + 0x1c) >>> 0, targetX >>> 0)
      m.setU32((pMissPkt + 0x20) >>> 0, targetY >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pMissPkt)
      return 1
    }

    const range = (spread * 2) | 0
    for (let i = 0; i < count; i += 1) {
      const rx = ((SEED_RollLimitedFast113c(m, pSeed, range) | 0) - spread + targetX) | 0
      m.setU32((pMissPkt + 0x1c) >>> 0, rx >>> 0)
      const ry = ((SEED_RollLimitedFast113c(m, pSeed, range) | 0) - spread + targetY) | 0
      m.setU32((pMissPkt + 0x20) >>> 0, ry >>> 0)

      const uTypeY = m.u32(caster) | 0
      const pPathY = m.u32((caster + 0x2c) >>> 0) >>> 0
      let casterY: number
      if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
        casterY = m.u32((pPathY + 0x10) >>> 0) | 0
      } else {
        casterY = pPathY !== 0 ? PATH_GetPosY113c(m, pPathY) | 0 : 0
      }

      const uTypeX = m.u32(caster) | 0
      const pPathX = m.u32((caster + 0x2c) >>> 0) >>> 0
      let casterX: number
      if (uTypeX === 2 || (uTypeX > 3 && uTypeX <= 5)) {
        casterX = m.u32((pPathX + 0x0c) >>> 0) | 0
      } else {
        casterX = pPathX !== 0 ? PATH_GetPosX113c(m, pPathX) | 0 : 0
      }

      if ((PATH_ComputeSquaredDistance113c(casterX, casterY, rx, ry) | 0) >= 4) {
        MISSILE_CreateServerProjectile113c(m, game, pMissPkt)
      }
    }
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * [35/45] Spawns charge-scaled count (`0x6FCB1240`) of charged server missiles (`0x6FCB1340`)
 * at `pCaster`'s target coords with random `[-20, +20)` target offsets and seeds each missile's
 * `(TargetX, TargetY)` via `MISSILE_SetTargetX113c` / `MISSILE_SetTargetY113c`.
 *
 * @va D2Game:0x6FCB3BC0
 */
export function SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCaster: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB3BC0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const caster = pCaster >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    const pCasterSeed = (caster + 0x20) >>> 0
    const prod0 =
      BigInt(m.u32(pCasterSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pCasterSeed + 4) >>> 0) >>> 0)
    const seedLo = Number(prod0 & 0xffffffffn) >>> 0
    const seedHi = Number((prod0 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pCasterSeed + 4) >>> 0, seedHi)
    m.setU32(pCasterSeed, seedLo)

    const pLocalSeed = allocW5B2Stack(m, 8) >>> 0
    SEED_InitLowSeed113c(m, pLocalSeed, seedLo)

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    const pCoords = allocW5B2Stack(m, 8) >>> 0
    if (skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, caster, game, pCoords, (pCoords + 4) >>> 0) === 0) {
      return 0
    }
    const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, caster) | 0
    if (nMissileId <= 0) return 0

    const nCount = skillsEvalChargeScaledCalcByStage_6FCB1240(m, caster, skillId, skillLevel) | 0
    if (nCount === 0) return 0

    const pMissPkt = allocW5B2Stack(m, 0x5c) >>> 0
    for (let i = 0; i < 0x17; i += 1) {
      m.setU32((pMissPkt + i * 4) >>> 0, 0)
    }
    m.setU32(pMissPkt, 0x03)
    m.setU32((pMissPkt + 0x04) >>> 0, caster)
    m.setU32((pMissPkt + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pMissPkt + 0x14) >>> 0, m.u32(pCoords) >>> 0)
    m.setU32((pMissPkt + 0x18) >>> 0, m.u32((pCoords + 4) >>> 0) >>> 0)
    m.setU32((pMissPkt + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pMissPkt + 0x30) >>> 0, skillLevel >>> 0)

    if (nCount > 0) {
      for (let i = 0; i < nCount; i += 1) {
        const remX = SEED_RollLimitedFast113c(m, pLocalSeed, 0x28) | 0
        let dx = (remX - 0x14) | 0
        const remY = SEED_RollLimitedFast113c(m, pLocalSeed, 0x28) | 0
        const dy = (remY - 0x14) | 0
        if (dx === 0 && dy === 0) {
          dx = 0x14
        }
        m.setU32((pMissPkt + 0x1c) >>> 0, dx >>> 0)
        m.setU32((pMissPkt + 0x20) >>> 0, dy >>> 0)
        const pMissile = MISSILE_CreateServerProjectile113c(m, game, pMissPkt) >>> 0
        if (pMissile !== 0) {
          const lowSeed = SEED_GetLowSeed113c(m, pLocalSeed) | 0
          MISSILE_SetTargetX113c(m, pMissile, lowSeed)
          const packedXY = (((dy & 0xffff) << 16) | (dx & 0xffff)) | 0
          MISSILE_SetTargetY113c(m, pMissile, packedXY)
        }
      }
    }
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

function skillsAddProgressiveChargeStage_6FCB5370(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nLevel: number,
  nState: number,
  nStatId: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const lvl = nLevel | 0
  const stateId = nState | 0
  const statId = nStatId | 0
  const nAuraLen =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0,
      skillId,
      lvl,
    ) | 0
  const nExpireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nAuraLen) | 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, stateId) >>> 0
  if (pStatList === 0) {
    const dwOwnerType = pUnit !== 0 ? m.u32(pUnit >>> 0) | 0 : 6
    const dwOwnerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
    void m.u32((pGame + 0x1c) >>> 0)
    pStatList = STATLIST_AllocList113c(m, 2, dwOwnerType, dwOwnerId, 0, nExpireFrame) >>> 0
    if (pStatList === 0) return 0

    STATLIST_SetState113c(m, pStatList, stateId)
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcb0f00)
    STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
    STATLIST_SetStat113c(m, pStatList, 0x15e, skillId, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15f, lvl, 0)
  }

  STATLIST_SetExpireFrameEx113c(m, pStatList, nExpireFrame)
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, nExpireFrame, 0, 0, 0)

  const nCurCharges = STATLIST_GetStatValue113c(m, pStatList, statId, 0) | 0
  let nNextCharges = (nCurCharges + 1) | 0
  if (nNextCharges > 3) {
    nNextCharges = 3
  }
  if (nCurCharges !== nNextCharges) {
    STATLIST_SetStat113c(m, pStatList, statId, nNextCharges, 0)
    const nAuraStat2 = (m.u16((pSkillsTxt + 0x56) >>> 0) << 16) >> 16
    if (nAuraStat2 >= 0 && nAuraStat2 < (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) {
      const nAddVal =
        SKILLS_EvalCalcByOffset113c(
          m,
          pUnit >>> 0,
          m.u32((pSkillsTxt + 0x6c) >>> 0) >>> 0,
          skillId,
          lvl,
        ) | 0
      STATLIST_AddStatMemPort113c(m, pStatList, nAuraStat2, nAddVal, 0)
    }
    STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, stateId, 1)
    STATES_ClearGfxStateFlag113c(m, pUnit >>> 0, stateId, 1)
  }
  return 1
}

function petsSendPetOrMercAssignPacket_6FCB66E0(
  m: D2KernMemory113c,
  pPlayer: number,
  pPetNode: number,
): number {
  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const dwSeed = m.u32((pPetNode + 0x10) >>> 0) >>> 0
  const dwWParam = m.u32((pPetNode + 0x14) >>> 0) >>> 0
  if (dwSeed === 0 && dwWParam === 0) {
    return NET_SendPacket7A_SummonChange_6FCAB290_113c(
      m,
      1,
      pClient,
      m.u32((pPetNode + 0x0c) >>> 0) & 0xff,
      m.u32(pPetNode >>> 0) >>> 0,
      m.u32((pPetNode + 0x04) >>> 0) >>> 0,
      m.u16((pPetNode + 0x08) >>> 0),
    )
  }

  return NET_SendPacket81_AssignMerc_6FCAB220_113c(
    m,
    m.u32(pPetNode >>> 0) >>> 0,
    pClient,
    m.u32((pPetNode + 0x0c) >>> 0) & 0xff,
    m.u32((pPetNode + 0x04) >>> 0) >>> 0,
    m.u16((pPetNode + 0x08) >>> 0),
    dwSeed,
    dwWParam,
  )
}

function petsSendPacket7A_UnsummonPet_6FCB6810(
  m: D2KernMemory113c,
  pPlayer: number,
  pPetNode: number,
): number {
  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  return withK2W5B2Stack113c(m, 0x10, (pPkt) => {
    m.setU32(pPkt, 0)
    m.setU32((pPkt + 0x04) >>> 0, 0)
    m.setU32((pPkt + 0x08) >>> 0, 0)
    m.setU8((pPkt + 0x0c) >>> 0, 0)
    m.setU8(pPkt, 0x7a)
    m.setU8((pPkt + 0x01) >>> 0, 0)
    m.setU8((pPkt + 0x02) >>> 0, m.u8((pPetNode + 0x0c) >>> 0))
    m.setU16((pPkt + 0x03) >>> 0, m.u16((pPetNode + 0x08) >>> 0))
    m.setU32((pPkt + 0x05) >>> 0, m.u32((pPetNode + 0x04) >>> 0) >>> 0)
    m.setU32((pPkt + 0x09) >>> 0, m.u32(pPetNode >>> 0) >>> 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x0d) | 0
  })
}

function syncWarpedPetClientsBeforeUpdate113c(
  m: D2KernMemory113c,
  pOldRoom: number,
  pPetUnit: number,
  pGame: number,
): void {
  const pCurrRoomSync = UNITS_GetRoom113c(m, pPetUnit >>> 0) >>> 0
  const pPrevRoomSync = pOldRoom >>> 0
  if (pCurrRoomSync !== pPrevRoomSync) {
    const currClients = pCurrRoomSync !== 0 ? (m.u32((pCurrRoomSync + 0x48) >>> 0) >>> 0) : 0
    const currCount = pCurrRoomSync !== 0 ? (m.u32((pCurrRoomSync + 0x78) >>> 0) >>> 0) : 0
    const prevClients = pPrevRoomSync !== 0 ? (m.u32((pPrevRoomSync + 0x48) >>> 0) >>> 0) : 0
    const prevCount = pPrevRoomSync !== 0 ? (m.u32((pPrevRoomSync + 0x78) >>> 0) >>> 0) : 0
    let iCurr = 0
    let iPrev = 0
    while (iCurr < currCount && iPrev < prevCount && currClients !== 0 && prevClients !== 0) {
      const pClCurr = m.u32((currClients + iCurr * 4) >>> 0) >>> 0
      const pClPrev = m.u32((prevClients + iPrev * 4) >>> 0) >>> 0
      if (pClCurr < pClPrev) {
        if (pClCurr !== 0 && (CLIENTS_GetPlayerUnit113c(m, pClCurr, 0) >>> 0) !== (pPetUnit >>> 0)) {
          UNIT_SendFullUnitSyncToClient113c(m, pClCurr, pPetUnit >>> 0, 0, undefined, pGame >>> 0)
        }
        iCurr++
      } else if (pClCurr > pClPrev) {
        iPrev++
      } else {
        iCurr++
        iPrev++
      }
    }
    while (iCurr < currCount && currClients !== 0) {
      const pClCurr = m.u32((currClients + iCurr * 4) >>> 0) >>> 0
      if (pClCurr !== 0 && (CLIENTS_GetPlayerUnit113c(m, pClCurr, 0) >>> 0) !== (pPetUnit >>> 0)) {
        UNIT_SendFullUnitSyncToClient113c(m, pClCurr, pPetUnit >>> 0, 0, undefined, pGame >>> 0)
      }
      iCurr++
    }
  }
}

function petsWarpPetUnitToRoomAndCoord_6FCB71F0(
  m: D2KernMemory113c,
  pPetUnit: number,
  pTargetRoom: number,
  pGame: number,
  nX: number,
  nY: number,
): void {
  PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c(
    m,
    pPetUnit,
    pTargetRoom,
    pGame,
    nX,
    nY,
    syncWarpedPetClientsBeforeUpdate113c,
  )
}

function skillsRollUnitWeaponBasePhysicalDamage256ths_6FCB87D0(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  void STATLIST_GetMaxLifeFromUnit113c
  void STATLIST_GetMaxManaFromUnit113c
  void STATLIST_GetMaxStaminaFromUnit113c
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pUnit >>> 0) >>> 0
  let nMinDmg: number
  let nMaxDmg: number
  if (pWeapon !== 0) {
    const nHandClass =
      INVENTORY_GetEquippedWeaponHandClass113c(m, pUnit >>> 0, m.u32((pUnit + 0x60) >>> 0) >>> 0) |
      0
    if (nHandClass === 2) {
      nMinDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x17, 0) | 0
      nMaxDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x18, 0) | 0
    } else {
      nMinDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x15, 0) | 0
      nMaxDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x16, 0) | 0
    }
  } else {
    nMinDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x15, 0) | 0
    if (nMinDmg <= 0) {
      nMinDmg = 1
    }
    nMaxDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x16, 0) | 0
    if (nMaxDmg <= 1) {
      nMaxDmg = 2
    }
  }

  nMinDmg = (nMinDmg << 8) | 0
  nMaxDmg = (nMaxDmg << 8) | 0
  if (nMinDmg < 1) {
    nMinDmg = 0x100
  }
  if (nMaxDmg <= nMinDmg) {
    nMaxDmg = (nMinDmg + 0x100) | 0
  }

  const nRange = (nMaxDmg - nMinDmg) | 0
  if (nRange <= 0) {
    return nMinDmg
  }

  const pSeed = (pUnit + 0x20) >>> 0
  const prod =
    BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const lo = Number(prod & 0xffffffffn) >>> 0
  const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed, lo)
  m.setU32((pSeed + 0x04) >>> 0, hi)

  const uRange = nRange >>> 0
  const nOffset =
    (uRange & ((uRange - 1) >>> 0)) === 0 ? (lo & (uRange - 1)) | 0 : (lo % uRange) | 0
  return (nMinDmg + nOffset) | 0
}

/**
 * @va D2Game:0x6FCB4970
 */
export function SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCaster: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB4970)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const caster = pCaster >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    const pCasterSeed = (caster + 0x20) >>> 0
    const prod0 =
      BigInt(m.u32(pCasterSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pCasterSeed + 4) >>> 0) >>> 0)
    const seedLo = Number(prod0 & 0xffffffffn) >>> 0
    const seedHi = Number((prod0 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pCasterSeed + 4) >>> 0, seedHi)
    m.setU32(pCasterSeed, seedLo)

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    const pCoords = allocW5B2Stack(m, 8) >>> 0
    if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
        m,
        caster,
        game,
        pCoords,
        (pCoords + 4) >>> 0,
      ) === 0
    ) {
      return 0
    }
    const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, caster) | 0
    if (nMissileId <= 0) return 0

    let nRadius = skillsEvalChargeScaledCalcByStage_6FCB1240(m, caster, skillId, skillLevel) | 0
    if (nRadius === 0) {
      nRadius =
        SKILLS_EvalCalcByOffset113c(
          m,
          caster,
          m.u32((pSkillsTxt + 0x64) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
    }

    const pMissPkt = allocW5B2Stack(m, 0x5c) >>> 0
    for (let i = 0; i < 0x17; i += 1) {
      m.setU32((pMissPkt + i * 4) >>> 0, 0)
    }
    m.setU32(pMissPkt, 1)
    m.setU32((pMissPkt + 0x04) >>> 0, caster)
    m.setU32((pMissPkt + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pMissPkt + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pMissPkt + 0x30) >>> 0, skillLevel >>> 0)

    const pLocalSeed = allocW5B2Stack(m, 8) >>> 0
    SEED_InitLowSeed113c(m, pLocalSeed, seedLo)

    const pCasterRoom = UNITS_GetRoom113c(m, caster) >>> 0
    const nArea = imul32(nRadius, nRadius) | 0
    const nDiam = (nRadius * 2) | 0
    if (nArea > 0) {
      const targetX = m.u32(pCoords) | 0
      const targetY = m.u32((pCoords + 4) >>> 0) | 0
      for (let i = 0; i < nArea; i += 1) {
        const dx = (nRadius - (SEED_RollLimitedFast113c(m, pLocalSeed, nDiam) | 0)) | 0
        const dy = (nRadius - (SEED_RollLimitedFast113c(m, pLocalSeed, nDiam) | 0)) | 0
        if ((imul32(dx, dx) + imul32(dy, dy)) <= nArea) {
          const tx = (targetX + dx) | 0
          const ty = (targetY + dy) | 0
          m.setU32((pMissPkt + 0x14) >>> 0, tx >>> 0)
          m.setU32((pMissPkt + 0x18) >>> 0, ty >>> 0)
          if ((ROOM_FindRoomContainingSubtile113c(m, pCasterRoom, tx, ty) >>> 0) !== 0) {
            MISSILE_CreateServerProjectile113c(m, game, pMissPkt)
          }
        }
      }
    }
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * @va D2Game:0x6FCB5690
 */
export function SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB5690)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const attacker = pAttacker >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
    if (pTarget === attacker || pTarget === 0) return 0

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    const wAuraState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
    if (wAuraState < 0 || wAuraState >= (m.u32((pDataTables + 0xc4) >>> 0) | 0)) return 0
    const wAuraStat1 = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
    if (wAuraStat1 < 0 || wAuraStat1 >= (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) return 0

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 0x1c; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }

    const nToHitBonus = SKILLS_GetSkillToHitBonus113c(m, attacker, skillId, skillLevel) | 0
    const wResultFlags =
      sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(m, pTarget, attacker, game, nToHitBonus, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)

    let bSrcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
    if (bSrcDam === 0) {
      bSrcDam = 0x80
    }
    SUNITDMG_AllocCombat113c(m, game, attacker, pTarget, pDmg, bSrcDam)

    const pCombatDmg = SUNITDMG_FindCombatDamageData113c(m, attacker, pTarget) >>> 0
    if (pCombatDmg !== 0 && (m.u8((pCombatDmg + 0x04) >>> 0) & 1) !== 0) {
      const nStat = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
      const nState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
      SKILLS_AddProgressiveChargeStage_6FCB5370_113c(
        m,
        attacker,
        game,
        skillId,
        skillLevel,
        nState,
        nStat,
      )
    }

    SUNITDMG_ExecuteEvents113c(m, game, attacker, pTarget, 1, pDmg)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * @va D2Game:0x6FCB6D70
 */
export function PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c(
  m: D2KernMemory113c,
  pPetUnit: number,
  pGame: number,
  pOwnerPlayer: number,
): number {
  hitD2GameVa113c(0x6FCB6D70)
  const petUnit = pPetUnit >>> 0
  const game = pGame >>> 0
  const ownerPlayer = pOwnerPlayer >>> 0

  const pPlayerData = UNITS_GetPlayerData113c(m, ownerPlayer) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('Pets.cpp', 0x402)
  }

  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPlayerPets === 0) return 0

  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  const nPetTypes = m.u32((pDataTables + 0xbf0) >>> 0) | 0
  if (nPetTypes <= 1) return 0

  for (let nType = 1, nOff = 0x0c; nType < nPetTypes; nType += 1, nOff += 0x0c) {
    if (nOff >= 0 && nType < nPetTypes) {
      const pListBase = m.u32(pPlayerPets) >>> 0
      const pSlot = (pListBase + nOff) >>> 0
      if (pSlot !== 0) {
        let pNode = m.u32(pSlot) >>> 0
        while (pNode !== 0) {
          const dwPetGuid = petUnit !== 0 ? m.u32((petUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
          if ((m.u32((pNode + 0x04) >>> 0) >>> 0) === dwPetGuid) {
            m.setU32(pNode, (m.u32(pNode) & 0xfffffffe) >>> 0)
            return withK2W5B2Stack113c(m, 0x20, (pNotify) => {
              for (let i = 0; i < 7; i += 1) {
                m.setU32((pNotify + i * 4) >>> 0, 0)
              }
              m.setU32((pNotify + 0x0c) >>> 0, nType >>> 0)
              m.setU32(pNotify, m.u32((pNode + 0x04) >>> 0) >>> 0)
              m.setU16(
                (pNotify + 0x08) >>> 0,
                petUnit !== 0 ? m.u16((petUnit + 0x04) >>> 0) : 0xffff,
              )
              m.setU32(
                (pNotify + 0x04) >>> 0,
                ownerPlayer !== 0 ? m.u32((ownerPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff,
              )
              m.setU32((pNotify + 0x10) >>> 0, m.u32((pNode + 0x08) >>> 0) >>> 0)
              m.setU32((pNotify + 0x14) >>> 0, m.u32((pNode + 0x0c) >>> 0) >>> 0)
              D2GAME_SUNIT_IterateAllLivingPlayers113c(
                m,
                game,
                (mem, _g, pPlayer, pArg) => {
                  petsSendPetOrMercAssignPacket_6FCB66E0(mem, pPlayer, pArg)
                },
                pNotify,
              )
              return 1
            })
          }
          pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
        }
      }
    }
  }
  return 0
}

/**
 * @va D2Game:0x6FCB72C0
 */
export function PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c(
  m: D2KernMemory113c,
  pPetSlot: number,
  pTargetRoom: number,
  pGame: number,
  nX: number,
  nY: number,
): void {
  hitD2GameVa113c(0x6FCB72C0)
  const targetRoom = pTargetRoom >>> 0
  const game = pGame >>> 0
  const x = nX | 0
  const y = nY | 0
  let pNode = m.u32(pPetSlot >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u8(pNode) & 1) === 0) {
      const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
      if (game === 0) {
        throw new D2CommonAssertError('Pets.cpp', 0x2d3)
      }
      let pPetUnit = m.u32((game + 0x1320 + (dwPetGuid & 0x7f) * 4) >>> 0) >>> 0
      while (pPetUnit !== 0) {
        if ((m.u32((pPetUnit + 0x0c) >>> 0) >>> 0) === dwPetGuid) {
          petsWarpPetUnitToRoomAndCoord_6FCB71F0(m, pPetUnit, targetRoom, game, x, y)
          break
        }
        pPetUnit = m.u32((pPetUnit + 0xe4) >>> 0) >>> 0
      }
    }
    pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
  }
}

/**
 * @va D2Game:0x6FCB77E0
 */
export function PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwPetGuid: number,
): void {
  hitD2GameVa113c(0x6FCB77E0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const petGuid = dwPetGuid >>> 0
    if (game === 0) {
      throw new D2CommonAssertError('Pets.cpp', 0x2d3)
    }

    let pPetUnit = m.u32((game + 0x1320 + (petGuid & 0x7f) * 4) >>> 0) >>> 0
    while (pPetUnit !== 0 && (m.u32((pPetUnit + 0x0c) >>> 0) >>> 0) !== petGuid) {
      pPetUnit = m.u32((pPetUnit + 0xe4) >>> 0) >>> 0
    }
    if (pPetUnit === 0) return

    if (((m.u32((pPetUnit + 0xc8) >>> 0) >>> 8) & 1) !== 0) {
      throw new D2CommonAssertError('Pets.cpp', 0x5a)
    }

    m.setU32((pPetUnit + 0xc4) >>> 0, (m.u32((pPetUnit + 0xc4) >>> 0) | 0x4000000) >>> 0)
    if ((MONSTATS_CheckFlagBit113c(m, m.u32((pPetUnit + 0x04) >>> 0) | 0, 0x0f) | 0) !== 0) {
      sunitdmgKillUnit_6FCFEEE0(m, game, pPetUnit)
    } else {
      SKILLS_SetUsedSkillMemPort113c(m, pPetUnit, 0)
      const pOwner = SUNIT_GetOwnerUnit113c(m, pPetUnit, game) >>> 0
      MONSTER_StartMode113c(m, game, pPetUnit, 0, pOwner, 0, 0)
    }

    const pUnsummonNode = allocW5B2Stack(m, 0x1c) >>> 0
    for (let i = 0; i < 7; i += 1) {
      m.setU32((pUnsummonNode + i * 4) >>> 0, 0)
    }
    m.setU32(pUnsummonNode, petGuid)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      game,
      (mem, _g, pPlayer, pArg) => {
        petsSendPacket7A_UnsummonPet_6FCB6810(mem, pPlayer, pArg)
      },
      pUnsummonNode,
    )
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * @va D2Game:0x6FCB8450
 */
export function STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCB8450)
  const unit = pUnit >>> 0
  STATES_ToggleGfxStateFlag113c(m, unit, nState | 0, 0)
  if ((STATES_CheckState113c(m, unit, 0x55) | 0) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, unit, 0x55, 0)
  }
  SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c(m, unit)
  SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c(m, unit)
}

/**
 * @va D2Game:0x6FCB8BA0
 */
export function SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB8BA0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const attacker = pAttacker >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    const pSkill = SKILLS_GetUsedSkillMemPort113c(m, attacker) >>> 0
    if (pSkill === 0) return 0

    SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
    if (pTarget === attacker || pTarget === 0) return 0

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 0x1c; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }

    const nToHitBonus = SKILLS_GetSkillToHitBonus113c(m, attacker, skillId, skillLevel) | 0
    const wResultFlags =
      sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(m, pTarget, attacker, game, nToHitBonus, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)

    if ((wResultFlags & 1) !== 0) {
      const bSrcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
      const nPhysDmg =
        sunitdmgRollPhysicalDamage_6FCFC530(m, 0, attacker, 1, 0, 0, 0, 0, bSrcDam) | 0
      m.setU32(pDmg, 1)
      m.setU32((pDmg + 0x08) >>> 0, nPhysDmg >>> 0)
      m.setU16(
        (pDmg + 0x04) >>> 0,
        (m.u16((pDmg + 0x04) >>> 0) | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff,
      )
      m.setU32(pDmg, (m.u32((pSkillsTxt + 0x130) >>> 0) | 1) >>> 0)

      const nBaseRoll = skillsRollUnitWeaponBasePhysicalDamage256ths_6FCB87D0(m, attacker) | 0

      let nFirePct =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      if (nFirePct !== 0) {
        const nFireMastery = STATLIST_GetUnitStat113c(m, attacker, 0x149, 0) | 0
        if (nFireMastery !== 0) {
          nFirePct = (nFirePct + (mulDiv113c(nFireMastery, nFirePct, 100) | 0)) | 0
        }
      }
      const nFireDmg = mulDiv113c(nFirePct, nBaseRoll, 100) | 0
      m.setU32((pDmg + 0x10) >>> 0, ((m.u32((pDmg + 0x10) >>> 0) | 0) + nFireDmg) >>> 0)

      let nLtngPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      if (nLtngPct !== 0) {
        const nLtngMastery = STATLIST_GetUnitStat113c(m, attacker, 0x14b, 0) | 0
        if (nLtngMastery !== 0) {
          nLtngPct = (nLtngPct + (mulDiv113c(nLtngMastery, nLtngPct, 100) | 0)) | 0
        }
      }
      const nLtngDmg = mulDiv113c(nLtngPct, nBaseRoll, 100) | 0
      m.setU32((pDmg + 0x24) >>> 0, ((m.u32((pDmg + 0x24) >>> 0) | 0) + nLtngDmg) >>> 0)

      let nColdPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x140) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      if (nColdPct !== 0) {
        const nColdMastery = STATLIST_GetUnitStat113c(m, attacker, 0x14a, 0) | 0
        if (nColdMastery !== 0) {
          nColdPct = (nColdPct + (mulDiv113c(nColdMastery, nColdPct, 100) | 0)) | 0
        }
      }
      const nColdDmg = mulDiv113c(nColdPct, nBaseRoll, 100) | 0
      m.setU32((pDmg + 0x1c) >>> 0, ((m.u32((pDmg + 0x1c) >>> 0) | 0) + nColdDmg) >>> 0)

      const nColdLen = SKILLS_GetSkillPeriodicDelayOrLength113c(m, attacker, skillId, skillLevel, 1) | 0
      m.setU32((pDmg + 0x30) >>> 0, ((m.u32((pDmg + 0x30) >>> 0) | 0) + nColdLen) >>> 0)

      const nParam1 = SKILLS_GetParam1113c(m, pSkill) | 0
      if (nParam1 === 0) {
        m.setU32((pDmg + 0x60) >>> 0, 0x20)
      } else if (nParam1 === 1) {
        m.setU32((pDmg + 0x60) >>> 0, 0x30)
      } else if (nParam1 === 2) {
        m.setU32((pDmg + 0x60) >>> 0, 0x40)
      }
      const nNextParam1 = ((nParam1 + 1) | 0) - imul32(sdiv32((nParam1 + 1) | 0, 3), 3)
      SKILLS_SetParam1113c(m, pSkill, nNextParam1)
    }

    SUNITDMG_AllocCombat113c(m, game, attacker, pTarget, pDmg, 0x80)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * @va D2Game:0x6FCB8E90
 */
export function SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB8E90)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const attacker = pAttacker >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    if ((SKILLS_GetUsedSkillMemPort113c(m, attacker) >>> 0) === 0) return 0
    SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
    if (pTarget === attacker || pTarget === 0) return 0
    if ((UNITS_CanUnitMeleeAttackTarget113c(m, attacker, pTarget, 0) | 0) === 0) return 0

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 0x1c; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }

    const nToHitBonus = SKILLS_GetSkillToHitBonus113c(m, attacker, skillId, skillLevel) | 0
    const wResultFlags =
      sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(m, pTarget, attacker, game, nToHitBonus, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)

    if ((wResultFlags & 1) !== 0) {
      const nCalc1 =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      const bSrcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
      const nPhysDmg =
        sunitdmgRollPhysicalDamage_6FCFC530(m, nCalc1, attacker, 1, 0, 0, 0, 0, bSrcDam) | 0
      m.setU32((pDmg + 0x08) >>> 0, nPhysDmg >>> 0)

      const bElemType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
      if (bElemType > 0) {
        const nConvPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            attacker,
            m.u32((pSkillsTxt + 0x144) >>> 0) >>> 0,
            skillId,
            skillLevel,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, nConvPct >>> 0)
        if (nConvPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, m.u8((pSkillsTxt + 0x1dc) >>> 0))
        }
      }

      skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, attacker, pDmg, skillLevel)
      m.setU32(pDmg, 1)
      m.setU16(
        (pDmg + 0x04) >>> 0,
        (m.u16((pDmg + 0x04) >>> 0) | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff,
      )
      m.setU32(pDmg, (m.u32((pSkillsTxt + 0x130) >>> 0) | 1) >>> 0)
    }

    SUNITDMG_AllocCombat113c(m, game, attacker, pTarget, pDmg, 0x80)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * @va D2Game:0x6FCB9000
 */
export function SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB9000)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const attacker = pAttacker >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
    if (pTarget === attacker || pTarget === 0) return 0
    if ((UNITS_CanUnitMeleeAttackTarget113c(m, attacker, pTarget, 0) | 0) === 0) return 0

    const pDmg = allocW5B2Stack(m, 0x70) >>> 0
    for (let i = 0; i < 0x1c; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }

    let wResultFlags = 0
    if (m.u32(attacker) === 0) {
      const pShieldOut = allocW5B2Stack(m, 4) >>> 0
      m.setU32(pShieldOut, 0)
      if (
        (INVENTORY_GetEquippedShield113c(m, m.u32((attacker + 0x60) >>> 0) >>> 0, pShieldOut) | 0) ===
        0
      ) {
        return 0
      }
      const pShield = m.u32(pShieldOut) >>> 0
      const dwShieldClassId = pShield !== 0 ? m.u32((pShield + 0x04) >>> 0) | 0 : -1
      const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, dwShieldClassId) >>> 0
      if (pItemsTxt === 0) return 0

      let nShieldMin256 = (m.u8((pItemsTxt + 0xfe) >>> 0) << 8) | 0
      let nShieldMax256 = (m.u8((pItemsTxt + 0xff) >>> 0) << 8) | 0

      if ((STATES_CheckState113c(m, attacker, 0x65) | 0) !== 0) {
        const pHolyShieldList =
          STATLIST_GetStatListFromUnitAndStateMemPort113c(m, attacker, 0x65) >>> 0
        if (pHolyShieldList !== 0) {
          const nHsSkillId = STATLIST_GetSkillId113c(m, pHolyShieldList) | 0
          const nHsLevel = STATLIST_GetSkillLevel113c(m, pHolyShieldList) | 0
          nShieldMin256 =
            (nShieldMin256 +
              (SKILLS_GetSkillPhysMinDamage113c(m, attacker, nHsSkillId, nHsLevel, 1) | 0)) |
            0
          nShieldMax256 =
            (nShieldMax256 +
              (SKILLS_GetSkillPhysMaxDamage113c(m, attacker, nHsSkillId, nHsLevel, 1) | 0)) |
            0
        }
      }

      const nCalc1 =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      const nPhysDmg =
        sunitdmgRollPhysicalDamage_6FCFC530(
          m,
          nCalc1,
          attacker,
          0,
          pShield,
          nShieldMin256,
          nShieldMax256,
          0,
          0x80,
        ) | 0
      m.setU32((pDmg + 0x08) >>> 0, nPhysDmg >>> 0)

      const nCalc2 =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      const bElemType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
      if (bElemType > 0) {
        const nConvPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            attacker,
            m.u32((pSkillsTxt + 0x144) >>> 0) >>> 0,
            skillId,
            skillLevel,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, nConvPct >>> 0)
        if (nConvPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, m.u8((pSkillsTxt + 0x1dc) >>> 0))
        }
      }

      skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, attacker, pDmg, skillLevel)
      m.setU32((pDmg + 0x44) >>> 0, nCalc2 >>> 0)
      m.setU32(pDmg, 2)
      wResultFlags =
        (sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(m, pTarget, attacker, game, 0, 0) | 1) & 0xffff
    } else {
      MONSTER_ApplyElementalDamageAndResistStats113c(m, game, attacker, 5)
      const nCalc2 =
        SKILLS_EvalCalcByOffset113c(
          m,
          attacker,
          m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0,
          skillId,
          skillLevel,
        ) | 0
      m.setU32((pDmg + 0x44) >>> 0, nCalc2 >>> 0)
      wResultFlags = sunitdmgRollMeleeToHitAndBlock_6FCFE5A0(m, pTarget, attacker, game, 0, 0) & 0xffff
    }

    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
    if ((wResultFlags & 1) !== 0) {
      m.setU16(
        (pDmg + 0x04) >>> 0,
        (wResultFlags | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff,
      )
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0)
    }

    m.setU32((pDmg + 0x60) >>> 0, 0x65)
    SUNITDMG_AllocCombat113c(m, game, attacker, pTarget, pDmg, 0x80)
    SUNITDMG_ExecuteEvents113c(m, game, attacker, pTarget, 1, pDmg)
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}

/**
 * @va D2Game:0x6FCB94C0
 */
export function SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCaster: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB94C0)
  const _savedSp_k2W5B2StackPtr = k2W5B2StackPtr
  try {
    const game = pGame >>> 0
    const caster = pCaster >>> 0
    const skillId = nSkillId | 0
    const skillLevel = nSkillLevel | 0

    if (skillId < 0) return 0
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables === 0) return 0
    if (skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
    const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    if (pSkillsTxt === 0) return 0

    const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, caster) | 0
    if (nMissileId <= 0) return 0

    const pCoords = allocW5B2Stack(m, 8) >>> 0
    if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
        m,
        caster,
        game,
        pCoords,
        (pCoords + 4) >>> 0,
      ) === 0
    ) {
      return 0
    }

    if (caster !== 0) {
      m.setU32((caster + 0xc4) >>> 0, (m.u32((caster + 0xc4) >>> 0) | 0x40) >>> 0)
    }

    const pMissPkt = allocW5B2Stack(m, 0x5c) >>> 0
    for (let i = 0; i < 0x17; i += 1) {
      m.setU32((pMissPkt + i * 4) >>> 0, 0)
    }
    m.setU32(pMissPkt, 0x20)
    m.setU32((pMissPkt + 0x04) >>> 0, caster)
    m.setU32((pMissPkt + 0x08) >>> 0, caster)
    m.setU32((pMissPkt + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pMissPkt + 0x1c) >>> 0, m.u32(pCoords) >>> 0)
    m.setU32((pMissPkt + 0x20) >>> 0, m.u32((pCoords + 4) >>> 0) >>> 0)
    m.setU32((pMissPkt + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pMissPkt + 0x30) >>> 0, skillLevel >>> 0)

    const pMissile = MISSILE_CreateServerProjectile113c(m, game, pMissPkt) >>> 0
    if (pMissile === 0) return 0

    const pMissilePath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
    PATH_SetType113c(m, pMissilePath, 0x0e)
    PATH_Compute113c(m, pMissilePath, pMissile, 0)

    const nScaleBonus = SKILLS_ScaleValueByMasteryAndSkillParam1113c(m, caster, skillLevel) | 0
    if (nScaleBonus !== 0) {
      const nFactor = (nScaleBonus + 100) | 0
      const nBase34 = STATLIST_GetUnitBaseStat113c(m, pMissile, 0x34, 0) | 0
      const nScaled34 = mulDiv113c(nFactor, nBase34, 100) | 0
      STATLIST_SetUnitStat113c(m, pMissile, 0x34, nScaled34, 0)

      const nBase35 = STATLIST_GetUnitBaseStat113c(m, pMissile, 0x35, 0) | 0
      const nScaled35 = mulDiv113c(nFactor, nBase35, 100) | 0
      STATLIST_SetUnitStat113c(m, pMissile, 0x35, nScaled35, 0)
    }
    return 1
  } finally {
    k2W5B2StackPtr = _savedSp_k2W5B2StackPtr
  }
}
