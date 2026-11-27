import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts';
import {
  UNITS_GetAnimStartFrame113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetRoom113c,
  UNITS_AreUnitsAligned113c,
  UNITS_IsShapeshifted113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_SyncDualWieldWeaponStatLists113c,
} from '../common/unit.ts';
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts';
import {
  UNITS_IsInMovingMode113c,
  UNITS_SetTargetUnitForDynamicUnit113c,
} from '../common/waypoint.ts';
import {
  STATLIST_AllocList113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetWeaponStatListActive113c,
  STATLIST_SetStat113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetStatValue113c,
  STATES_CheckStateMaskByIndexOnUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_UnlinkSubList113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
} from '../common/statlist.ts';
import {
  ITEMS_TestFlagMask113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_SetOrClearFlagMask113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_GetItemTypeFromItem113c,
} from '../common/items.ts';
import {
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_TestLineOfSightFromUnitToTarget113c,
  SKILLS_GetItemSkillInfo113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetWeaponMasteryPassiveStatId113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetSkillsTxtFromSkill113c,
} from '../common/skills.ts';
import {
  SEED_GetSeeds113c,
  SEED_SetSeeds113c,
} from '../common/drlg/drlg-grid.ts';
import {
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
  PATH_GetPosY113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetFirstPointX113c,
  UNITS_TransferStateMaskDCToRemoved113c,
  PATH_GetMaxDistance113c,
} from '../common/path.ts';
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_GetItemEquipLocation113c,
  INVENTORY_GetSecondaryWeapon113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts';
import {
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.ts';
import {
  DATATBLS_GetArenaTxtRecord113c,
} from '../tables/datatbls-113c.ts';
import {
  COMPOSIT_IsUnitUsingBowOrCrossbow113c,
  UNITS_GetPlayerData113c,
} from '../common/composit.ts';
import {
  MONSTERS_GetHirelingTypeId113c,
} from '../common/missile.ts';
import {
  SKILLS_GetFlags113c,
  UNITS_CanDualWield113c,
  PLAYER_GetEquippedWeapon113c,
} from './replay-kernel-113c.ts';
import {
  PLAYER_StartModeAtCoords113c,
} from './c2s-packet-113c.ts';
import {
  AIGENERAL_GetOwnerData_6FC40D50_113c,
  PLAYER_StartModeCast113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_GetPlayerClientClassId113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c.ts';
import {
  EVENT_GetNextEventFrame113c,
  EVENT_FreeNode113c,
  EVENT_DeleteEventByArg14_113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts';
import {
  SUNIT_IsDeadOrDying113c,
} from './monster-events.ts';
import {
  SUNIT_GetServerUnit113c,
} from './game-strc.ts';
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  SKILLS_GetRecordPtrFast113c,
} from './regpop-spawn-113c.ts';
import {
  ITEMEVENT_AttackerTakesDamage113c,
  ITEMEVENT_ChanceToCastSkill113c,
  ITEMEVENT_ManaAfterKill113c,
  NET_SendUnitTargetedSkillAction113c,
  SrvDoFunc_020_StaticField113c,
  SrvDoFunc_065_AuraRadialStatBuff113c,
} from './k2-gap-itemdef-113c.ts';
import {
  SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c,
  SEED_StepSeed64Fast_6FC21160_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts';
import { NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c } from './k2-w4b4-113c.ts';
import {
  SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c,
  SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c,
  SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c,
} from './k2-w4b5-113c.ts';
import {
  SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c,
  SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c,
  SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c,
  SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c,
} from './k2-w5b2-113c.ts';
import { SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c } from './k2-laneL-0x6fc6-w1-113c.ts';
import {
  D2GAME_PARTY_GetPartyIdForUnit113c,
} from './boot-init-gap-b-113c.ts';
import {
  ITEMS_SendDropToGroundPacket02_6FCAE030_113c,
  ITEMS_SendGroundItemPacket03_6FCADFD0_113c,
  PARTY_FindSubPartyById_6FCBBD00_113c,
} from './k2-w2b4-113c.ts';
import { UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c } from './k2-w3b8-113c.ts';
import { D2CommonAssertError } from '../common/inline-helpers.ts';
import {
  MONAI_EnableState172OnTarget_6FCCC910_113c,
  SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c,
} from './k2-w2b5-113c.ts';
import {
  SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c,
  SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c,
  SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c,
  SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c,
  SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c,
  SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c,
  SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c,
  SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c,
  SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c,
  SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c,
} from './k2-w3b4-113c.ts';
import {
  SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c,
  SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c,
} from './k2-w4b6-113c.ts';
import {
  ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c,
  ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c,
  ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c,
  ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c,
  ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c,
  ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c,
  ITEMMODS_ApplyKnockback_6FCCCE60_113c,
  ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c,
  ITEMMODS_ApplyMonsterFlee_6FCCD580_113c,
  ITEMMODS_ApplySlowTarget_6FCCD2A0_113c,
  ARENA_UpdatePlayerArenaScore_6FCD2820_113c,
} from './k2-w4b7-113c.ts';
import { SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c } from './k2-w5b1-113c.ts';
import {
  SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c,
  SUNITDMG_ProcHitOpenWounds_6FCCD410_113c,
} from './k2-w5b3-113c.ts';
import {
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c,
  SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c,
} from './k2-w6b2-113c.ts';
import {
  ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c,
  ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c,
  ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c,
  SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c,
  SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c,
} from './k2-w6b5-113c.ts';
import { ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c } from './k2-w7b3-113c.ts';
import { SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c } from './k2-w8b2-113c.ts';
import { QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c } from './k2-laneJ-0x6fc4-w1-113c.ts';
import { CLIENTS_GetPlayerUnit113c } from './replay-final11-113c.ts';
import { NET_QueuePacketToClient113c } from '../net/packet-sink.ts';
import { hitD2GameVa113c } from '../va-trace-113c.ts';

// ---------------------------------------------------------------------------
// Internal D2Game helper procedures (non-exported, used by F786..F1040 VAs)
// ---------------------------------------------------------------------------

/**
 * Enqueues a raw S2C packet payload into a D2ClientStrc's `D2PacketDataStrc` queue (`0x6FCAA3E0`).
 */
function enqueueClientPacketBytes113c(
  m: Memory113c,
  pClient: number,
  bytes: Uint8Array,
  nLen: number,
): number {
  if (pClient === 0 || nLen <= 0) {
    return 0;
  }
  const slice = nLen === bytes.byteLength ? bytes : bytes.subarray(0, nLen);
  return NET_QueuePacketToClient113c(m, pClient >>> 0, slice);
}

let a1cOwnerScratchPtr = 0x7fd90000;

/**
 * Resolves a monster unit's AI owner ID and owner unit type via canonical
 * `D2Game:0x6FC40D50` (`AIGENERAL_GetOwnerData_6FC40D50_113c`).
 */
function getMonsterAiOwnerIdAndType113c(
  m: Memory113c,
  pMonster: number,
): { ownerId: number; ownerType: number } {
  const sp = a1cOwnerScratchPtr;
  a1cOwnerScratchPtr = (sp + 8) >>> 0;
  try {
    m.setU32(sp, 0xffffffff);
    m.setU32((sp + 4) >>> 0, 0);
    AIGENERAL_GetOwnerData_6FC40D50_113c(m, pMonster, sp, (sp + 4) >>> 0);
    return {
      ownerId: m.u32(sp) | 0,
      ownerType: m.u32((sp + 4) >>> 0) | 0,
    };
  } finally {
    a1cOwnerScratchPtr = sp;
  }
}

/**
 * Checks whether a player-To-player pair has mutual hostility flag (mask 8)
 * in pPlayerData (+0x14) -> pPlrIntro/pPlayerRelation (+0x38).
 */
function checkPlayerPairPvpFlag113c(
  m: Memory113c,
  pPlayer1: number,
  nTargetUnitId: number,
  dwMask: number,
): number {
  if (pPlayer1 === 0 || m.u32(pPlayer1) !== 0) {
    return 0;
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer1);
  if (pPlayerData === 0) {
    return 0;
  }
  let pRel = m.u32(pPlayerData + 0x38);
  while (pRel !== 0) {
    if (m.u32(pRel) === (nTargetUnitId >>> 0)) {
      return (m.u32(pRel + 0x04) & (dwMask >>> 0)) !== 0 ? 1 : 0;
    }
    pRel = m.u32(pRel + 0x0c);
  }
  return 0;
}

/**
 * Jump table switch mask at D2Game.dll 0x6FC56028 (35 bytes, monClass 0x1A..0x3C):
 * `0` forces `bForceInactive = 1` in `QUESTS_OnMonsterKill113c`.
 */
const QUEST_KILL_MONCLASS_FORCE_JT_113C = new Uint8Array([
  0, 0, 1, 0, 1, 1, 1, 1,
  1, 1, 0, 0, 0, 0, 1, 1,
  0, 0, 0, 0, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 0,
]);

function getQuestSgptDataTablesPtr113c(m: Memory113c): number {
  const iatSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0;
  if (iatSlot !== 0) {
    const deref = m.u32(iatSlot) >>> 0;
    return deref !== 0 ? deref : iatSlot;
  }
  return m.u32(0x6fde9e1c) >>> 0;
}

/**
 * Builds an S2C 0x9C / 0x9D item action packet in scratch memory at `pBuf`.
 */
function buildItemActionPacketBuffer113c(
  m: Memory113c,
  pItem: number,
  pOwnerUnit: number,
  bOpcode: number,
  bAction: number,
  bIncludeSockets: number,
  nCmdFlagsOverride: number,
  bSimpleOnly: number,
  pBuf: number,
): number {
  if (pItem === 0 || m.u32(pItem) !== 4) {
    return 0;
  }
  const pItemData = m.u32(pItem + 0x14);
  if (pItemData === 0) {
    return 0;
  }
  const dwItemFlags = m.u32(pItemData + 0x18);
  let nCmdFlags = nCmdFlagsOverride;
  if (nCmdFlags === 0) {
    nCmdFlags = ITEMS_GetCommandFlags113c(m, pItem);
  }
  if ((dwItemFlags & 0x200000) !== 0) {
    bSimpleOnly = 1;
  }
  m.setU8(pBuf + 0x00, bOpcode & 0xff);
  m.setU8(pBuf + 0x01, bAction & 0xff);
  const headerSize = bOpcode === 0x9d ? 0x0d : 0x08;
  m.setU8(pBuf + 0x03, bOpcode === 0x9d ? m.u8(pItemData + 0x44) : 0);
  m.setU32(pBuf + 0x04, m.u32(pItem + 0x0c));
  if (bOpcode === 0x9d) {
    if (pOwnerUnit !== 0) {
      m.setU8(pBuf + 0x08, m.u32(pOwnerUnit) & 0xff);
      m.setU32(pBuf + 0x09, m.u32(pOwnerUnit + 0x0c));
    } else {
      m.setU8(pBuf + 0x08, 0xff);
      m.setU32(pBuf + 0x09, 0xffffffff);
    }
  }
  const serializedBytes = ITEMS_SerializeItemToBuffer113c(
    m,
    pItem,
    (pBuf + headerSize) >>> 0,
    (0x100 - headerSize) | 0,
    1,
    bIncludeSockets,
    bSimpleOnly,
  );
  if (serializedBytes <= 0) {
    return 0;
  }
  const totalLen = (headerSize + serializedBytes) | 0;
  m.setU8(pBuf + 0x02, totalLen & 0xff);
  return totalLen;
}

// ===========================================================================
// F786 (2 VAs)
// ===========================================================================

// @va D2Game:0x6FC69A50
export function UNITROOM_IsClientInUnitRoom113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69A50);
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0) {
    return 0;
  }
  const nClients = m.u32(pRoom + 0x78) | 0;
  if (nClients <= 0) {
    return 0;
  }
  const pClientArray = m.u32(pRoom + 0x48);
  const targetClient = pClient >>> 0;
  for (let i = 0; i < nClients; i = (i + 1) | 0) {
    if (m.u32(pClientArray + ((i * 4) | 0)) === targetClient) {
      return 1;
    }
  }
  return 0;
}

// @va D2Game:0x6FCADC30
export function S2C_SendPacket0F_UnitWalkToTarget113c(
  m: Memory113c,
  pClient: number,
  dwUnitId: number,
  bOpcode: number,
  bUnitType: number,
  bMoveType: number,
  dwTargetXY: number,
  bArg30: number,
  extraVelPct = 0,
  bArg31 = 0,
  maxDistOverride = -1,
): void {
  hitD2GameVa113c(0x6FCADC30);
  if (pClient === 0) {
    return;
  }
  const pGame = m.u32(pClient + 0x1a8);
  if (pGame === 0) {
    return;
  }
  let pUnit = m.u32(pGame + 0x1320 + ((dwUnitId & 0x7f) << 2));
  while (pUnit !== 0 && m.u32(pUnit + 0x0c) !== (dwUnitId >>> 0)) {
    pUnit = m.u32(pUnit + 0xe4);
  }
  let wCurX = 0;
  let wCurY = 0;
  let bPathType = 0;
  let wVelocityPct = 0;
  let bMaxDist = 0;
  if (pUnit !== 0) {
    const unitType = m.u32(pUnit);
    const pPath = m.u32(pUnit + 0x2c);
    if (unitType <= 1 || unitType === 3) {
      if (pPath !== 0) {
        wCurX = PATH_GetPosX113c(m, pPath) & 0xffff;
        wCurY = PATH_GetPosY113c(m, pPath) & 0xffff;
      }
    } else if (pPath !== 0) {
      wCurX = m.u16(pPath + 0x04);
      wCurY = m.u16(pPath + 0x06);
    }
    const rawPathType = pPath !== 0 ? PATH_GetType113c(m, pPath) : 0;
    if (rawPathType === 5 || rawPathType === 6) {
      bPathType = 2;
    } else if (rawPathType === 8) {
      bPathType = 11;
    } else {
      bPathType = rawPathType & 0xff;
    }
    let velStat = ((STATLIST_GetUnitStat113c(m, pUnit, 0x43, 0) | 0) + (extraVelPct | 0)) | 0;
    if (velStat >= 0x7fff) {
      velStat = 0x7fff;
    } else if (velStat <= -32768) {
      velStat = -32768;
    }
    wVelocityPct = velStat & 0xffff;
    bMaxDist =
      maxDistOverride >= 0
        ? maxDistOverride & 0xff
        : pPath !== 0
          ? PATH_GetMaxDistance113c(m, pPath) & 0xff
          : 0;
  }
  const pkt = new Uint8Array(0x15);
  pkt[0x00] = bOpcode & 0xff;
  pkt[0x01] = dwUnitId & 0xff;
  pkt[0x02] = (dwUnitId >>> 8) & 0xff;
  pkt[0x03] = (dwUnitId >>> 16) & 0xff;
  pkt[0x04] = (dwUnitId >>> 24) & 0xff;
  pkt[0x05] = bUnitType & 0xff;
  pkt[0x06] = wCurX & 0xff;
  pkt[0x07] = (wCurX >>> 8) & 0xff;
  pkt[0x08] = wCurY & 0xff;
  pkt[0x09] = (wCurY >>> 8) & 0xff;
  pkt[0x0a] = bMoveType & 0xff;
  pkt[0x0b] = dwTargetXY & 0xff;
  pkt[0x0c] = (dwTargetXY >>> 8) & 0xff;
  pkt[0x0d] = (dwTargetXY >>> 16) & 0xff;
  pkt[0x0e] = (dwTargetXY >>> 24) & 0xff;
  pkt[0x0f] = bArg30 & 0xff;
  pkt[0x10] = bArg31 & 0xff;
  pkt[0x11] = bPathType & 0xff;
  pkt[0x12] = wVelocityPct & 0xff;
  pkt[0x13] = (wVelocityPct >>> 8) & 0xff;
  pkt[0x14] = bMaxDist & 0xff;
  enqueueClientPacketBytes113c(m, pClient, pkt, 0x15);
}

// ===========================================================================
// F795 (9 VAs)
// ===========================================================================

// @va D2Game:0x6FCBEC80
export function SKILLS_CheckSkillManaAndCharges113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCBEC80);
  if (pUnit === 0 || m.u32(pUnit) !== 0) {
    return 1;
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pSkill === 0) {
    return 0;
  }
  const ownerItemGuid = SKILLS_GetOwnerItemGuid113c(m, pSkill) | 0;
  if (ownerItemGuid !== -1) {
    const nCharges = (m.u32(pSkill + 0x38) | 0);
    return nCharges > 0 ? 1 : 0;
  }
  const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(m, pSkill);
  let slvl = (SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) - 1) | 0;
  if (slvl < 0) {
    slvl = 0;
  }
  const wMana = (m.u16(pSkillsTxt + 0x18a) << 16) >> 16;
  const wLvlMana = (m.u16(pSkillsTxt + 0x18c) << 16) >> 16;
  const bManaShift = m.u8(pSkillsTxt + 0x188) & 0x1f;
  const wSkillId = (m.u16(pSkillsTxt + 0x2e) << 16) >> 16;
  const manaCost = (wMana + Math.imul(slvl, wLvlMana)) << bManaShift;
  if (wSkillId === 0x74) {
    if (UNITS_IsShapeshifted113c(m, pUnit) !== 0) {
      return 1;
    }
  }
  const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0;
  return curMana >= manaCost ? 1 : 0;
}

function safeGetSkillsTxtPtr113c(m: Memory113c, nSkillId: number, pFallbackSkill = 0): number {
  try {
    const rec = SKILLS_GetRecordPtrFast113c(m, nSkillId);
    if (rec !== 0) return rec;
  } catch {
    // Minimal Heap113c unit fixtures without loaded 0x6FD1829C IAT slot fall back to pSkill->pSkillsTxt
  }
  return pFallbackSkill !== 0 ? (m.u32(pFallbackSkill) >>> 0) : 0;
}

// @va D2Game:0x6FCBF850
export function SKILLS_ConsumeSkillManaOrCharge113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  pGame: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCBF850);
  if (pUnit === 0 || m.u32(pUnit) !== 0) {
    return 1;
  }
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pUsedSkill !== 0) {
    const usedSkillId = SKILLS_GetSkillIdFromSkill113c(m, pUsedSkill, 0x6fd1b980, 0x3bb);
    if (usedSkillId === nSkillId) {
      const ownerItemGuid = SKILLS_GetOwnerItemGuid113c(m, pUsedSkill) | 0;
      if (ownerItemGuid !== -1) {
        return SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c(
          m as SparseMemory113c,
          pGame,
          pUnit,
          ownerItemGuid >>> 0,
          pUsedSkill,
        );
      }
    }
  }
  if (nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = safeGetSkillsTxtPtr113c(
    m,
    nSkillId,
    SKILLS_GetUsedSkillMemPort113c(m, pUnit),
  );
  if (pSkillsTxt === 0) {
    return 0;
  }
  const wMana = (m.u16(pSkillsTxt + 0x18a) << 16) >> 16;
  const wLvlMana = (m.u16(pSkillsTxt + 0x18c) << 16) >> 16;
  if (wMana === 0 && wLvlMana === 0) {
    return 0;
  }
  let effLvl = (nSkillLevel - 1) | 0;
  if (effLvl < 0) {
    effLvl = 0;
  }
  const bManaShift = m.u8(pSkillsTxt + 0x188) & 0x1f;
  let manaCost = (wMana + Math.imul(effLvl, wLvlMana)) << bManaShift;
  const minMana = ((m.u16(pSkillsTxt + 0x186) << 16) >> 16) << 8;
  if (minMana > manaCost) {
    manaCost = minMana;
  }
  if (STATES_CheckState113c(m, pUnit, 0x72) !== 0) {
    return SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, pUnit, manaCost);
  }
  const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0;
  if (curMana < manaCost) {
    return 0;
  }
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 8, (-manaCost) | 0, 0);
  return 1;
}

// @va D2Game:0x6FCBFC00
export function SKILLS_ValidateSkillTargetAlignment113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
): number {
  hitD2GameVa113c(0x6FCBFC00);
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32(pUnit + 0x2c);
  if (pPath === 0) {
    return 1;
  }
  const pTarget = PATH_GetTargetUnit113c(m, pPath);
  if (pTarget === 0 || pTarget === pUnit) {
    return 1;
  }
  if (nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = safeGetSkillsTxtPtr113c(
    m,
    nSkillId,
    SKILLS_GetUsedSkillMemPort113c(m, pUnit),
  );
  if (pSkillsTxt === 0) {
    return 0;
  }
  if ((m.u8(pSkillsTxt + 0x06) & 0x10) !== 0) {
    if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pUnit, pTarget, pGame) === 0) {
      const owner = getMonsterAiOwnerIdAndType113c(m, pTarget);
      let isOwnMinion = 0;
      if (
        owner.ownerId !== -1 &&
        owner.ownerType === (m.u32(pUnit) | 0) &&
        (owner.ownerId >>> 0) === m.u32(pUnit + 0x0c) &&
        (m.u8(pSkillsTxt + 0x07) & 0x02) !== 0
      ) {
        isOwnMinion = 1;
      }
      if (
        isOwnMinion === 0 &&
        SUNIT_CanPlayerTargetUnitWithSkill113c(m, pTarget, pGame, pUnit, nSkillId) === 0
      ) {
        return 0;
      }
    }
  }
  const targetFlags = m.u32(pTarget + 0xc4);
  if (((targetFlags >>> 1) & 1) === 0) {
    UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, 0);
    return 1;
  }
  const isCorpseSkill = (m.u8(pSkillsTxt + 0x07) & 0x01) !== 0;
  // 0x6FCBFCB3..0x6FCBFCDE: `cmp dword ptr [edi], 1; jne not_corpse; cmp dword ptr [edi + 0x10], 0xc` (`MONMODE_DEAD` only, NOT `MONMODE_DEATH = 0`!)
  const isDeadMonCorpse = m.u32(pTarget) === 1 && m.u32(pTarget + 0x10) === 0x0c;
  if (isDeadMonCorpse ? !isCorpseSkill : isCorpseSkill) {
    UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, 0);
  }
  return 1;
}

export type SkillsSrvStDispatcherFn113c = (
  m: Memory113c,
  wSrvStFunc: number,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
) => number;

let defaultSkillsSrvStDispatcher113c: SkillsSrvStDispatcherFn113c | null = null;

export function registerSkillsSrvStDispatcher113c(fn: SkillsSrvStDispatcherFn113c | null): void {
  defaultSkillsSrvStDispatcher113c = fn;
}

// @va D2Game:0x6FCBFD00
export function SKILLS_ExecuteSkillStart113c(
  m: Memory113c,
  nSkillId: number,
  pGame: number,
  pUnit: number,
  nSkillLevel: number,
  bNoManaCost: number,
  onSrvStFunc?: (
    m: Memory113c,
    wSrvStFunc: number,
    pGame: number,
    pUnit: number,
    nSkillId: number,
    nSkillLevel: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCBFD00);
  if (pGame === 0 || pUnit === 0) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0 || nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = safeGetSkillsTxtPtr113c(
    m,
    nSkillId,
    SKILLS_GetUsedSkillMemPort113c(m, pUnit),
  );
  if (pSkillsTxt === 0) {
    return 0;
  }
  if (bNoManaCost === 0 && SKILLS_CheckSkillManaAndCharges113c(m, pUnit) === 0) {
    return 0;
  }
  if ((m.u8(pSkillsTxt + 0x05) & 0x01) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
      return 0;
    }
  }
  const bLineOfSight = m.u8(pSkillsTxt + 0x18f);
  if (bLineOfSight !== 0) {
    const pPath = m.u32(pUnit + 0x2c);
    const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) : 0;
    let targetX = 0;
    let targetY = 0;
    if (pTarget !== 0) {
      targetX = UNIT_GetPosX113c(m, pTarget);
      targetY = UNIT_GetPosY113c(m, pTarget);
    } else if (pPath !== 0) {
      targetX = PATH_GetFirstPointX113c(m, pPath);
      targetY = PATH_GetFirstPointY113c(m, pPath);
    }
    if (targetX !== 0 && targetY !== 0) {
      let losMask = 0;
      if (bLineOfSight === 1) {
        losMask = 0x0004;
      } else if (bLineOfSight === 2) {
        losMask = 0x1c09;
      } else if (bLineOfSight === 3) {
        losMask = 0x0180;
      } else if (bLineOfSight === 4) {
        losMask = 0x0804;
      } else if (bLineOfSight === 5) {
        losMask = 0x0805;
      } else {
        return 0;
      }
      if (SKILLS_TestLineOfSightFromUnitToTarget113c(m, targetX, targetY, pUnit, losMask) === 0) {
        return 0;
      }
    }
  }
  const wSrvStFunc = (m.u16(pSkillsTxt + 0x2c) << 16) >> 16;
  let stResult = 1;
  if (wSrvStFunc > 0 && wSrvStFunc < 0x5b) {
    if (wSrvStFunc === 1) {
      stResult = SKILLS_StartPlayerSkillAnimOrCast113c(m, pGame, pUnit, nSkillId, nSkillLevel);
    } else if (onSrvStFunc !== undefined) {
      stResult = onSrvStFunc(m, wSrvStFunc, pGame, pUnit, nSkillId, nSkillLevel);
    } else if (defaultSkillsSrvStDispatcher113c !== null) {
      stResult = defaultSkillsSrvStDispatcher113c(m, wSrvStFunc, pGame, pUnit, nSkillId, nSkillLevel);
    }
  }
  if (stResult === 0) {
    return 0;
  }
  if (wSrvStFunc > 0 && (m.u8(pSkillsTxt + 0x08) & 0x20) === 0 && bNoManaCost === 0) {
    // D2Game:0x6FCBFE87 calls SKILLS_ConsumeSkillManaOrCharge and ignores its return value
    // (0-mana skills like Attack return 0 from 0x6FCBF850 without failing skill start).
    SKILLS_ConsumeSkillManaOrCharge113c(m, pUnit, nSkillId, pGame, nSkillLevel);
  }
  if ((m.u8(pSkillsTxt + 0x04) & 0x40) !== 0) {
    let pEv = m.u32(pUnit + 0xdc);
    while (pEv !== 0) {
      const pNext = m.u32(pEv + 0x1c);
      if (m.u32(pEv) === 8) {
        EVENT_FreeNode113c(m, pGame, pEv);
      }
      pEv = pNext;
    }
  }
  return stResult;
}

// @va D2Game:0x6FCC0830
export function SKILLS_StartUsedSkill113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  onSrvStFunc?: (
    m: Memory113c,
    wSrvStFunc: number,
    pGame: number,
    pUnit: number,
    nSkillId: number,
    nSkillLevel: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCC0830);
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pSkill === 0) {
    return 0;
  }
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0);
  if (nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = safeGetSkillsTxtPtr113c(
    m,
    nSkillId,
    SKILLS_GetUsedSkillMemPort113c(m, pUnit),
  );
  if (pSkillsTxt === 0) {
    return 0;
  }
  if (SKILLS_ValidateSkillTargetAlignment113c(m, pUnit, pGame, nSkillId) === 0) {
    if (pUnit !== 0 && m.u32(pUnit) === 0 && pGame !== 0) {
      PLAYER_StartModeAtCoords113c(m, pGame, pUnit, 5, 0, 0, 1);
    }
    return 0;
  }
  let nSkillLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1);
  let bNoManaCost = 0;
  const scratchBase = 0x004ff000;
  const pOutGuid = scratchBase;
  const pOutSkillId = scratchBase + 4;
  const pOutLevel = scratchBase + 8;
  const pOutCharges = scratchBase + 12;
  if (SKILLS_GetItemSkillInfo113c(m, pSkill, pOutGuid, pOutSkillId, pOutLevel, pOutCharges) !== 0) {
    if ((m.u32(pOutCharges) | 0) <= 0) {
      return 0;
    }
    nSkillLevel = (m.u32(pOutLevel) | 0);
    bNoManaCost = 1;
  }
  const pPath = m.u32(pUnit + 0x2c);
  if (pPath !== 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
    const pTarget = PATH_GetTargetUnit113c(m, pPath);
    if (pTarget !== 0 && pTarget !== pUnit) {
      // 0x6FCC0907..0x6FCC091F: if `!(pSkillsTxt[+7] & 0x04)` and `SUNIT_CanPlayerTargetUnitWithSkill(pTarget, pGame, pUnit, nSkillId) != 0` -> abort.
      if ((m.u8(pSkillsTxt + 0x07) & 0x04) === 0) {
        if (SUNIT_CanPlayerTargetUnitWithSkill113c(m, pTarget, pGame, pUnit, nSkillId) !== 0) {
          return 0;
        }
      }
    }
  }
  // 0x6FCC0925..0x6FCC0963: check unit's own room for town if skill lacks `intown` flag (`pSkillsTxt[+5] & 0x01`).
  if ((m.u8(pSkillsTxt + 0x05) & 0x01) === 0) {
    const pUnitRoom = UNITS_GetRoom113c(m, pUnit);
    if (pUnitRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pUnitRoom) !== 0) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
      if (m.u32(pUnit) === 0 && pGame !== 0) {
        PLAYER_StartModeAtCoords113c(m, pGame, pUnit, 5, 0, 0, 1);
      }
      return 0;
    }
  }
  const stRes = SKILLS_ExecuteSkillStart113c(m, nSkillId, pGame, pUnit, nSkillLevel, bNoManaCost, onSrvStFunc);
  if (m.u32(pUnit) === 0 && stRes === 0 && pGame !== 0) {
    PLAYER_StartModeAtCoords113c(m, pGame, pUnit, 5, 0, 0, 1);
  }
  return stRes;
}

// @va D2Game:0x6FCC1630
export function SKILLS_StartPlayerSkillAnimOrCast113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCC1630);
  if (pUnit === 0) {
    return 1;
  }
  const startFrame = UNITS_GetAnimStartFrame113c(m, pUnit);
  m.setU32(pUnit + 0x44, (startFrame << 8) >>> 0);
  if (STATES_CheckStateMaskByIndexOnUnit113c(m, pUnit, 0x26) !== 0) {
    return SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(
      m as SparseMemory113c,
      pGame,
      pUnit,
      nSkillLevel,
    );
  }
  if (
    COMPOSIT_IsUnitUsingBowOrCrossbow113c(m, pUnit) !== 0 &&
    SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(m as SparseMemory113c, pUnit) === 0
  ) {
    PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pUnit, 0, 1);
    PLAYER_StartModeCast113c(m, pGame, pUnit);
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FCEE310
export function C2S_BroadcastPlayerSkillOrAttackAction113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pClient: number,
  _bFlag = 0,
): void {
  hitD2GameVa113c(0x6FCEE310);
  if (pPlayer === 0 || pClient === 0) {
    return;
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pPlayer);
  if (pSkill === 0) {
    return;
  }
  const skillFlags = SKILLS_GetFlags113c(m, pSkill);
  if ((skillFlags & 0x04) === 0) {
    if ((pPlayer >>> 0) === (CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0)) {
      return;
    }
  }
  const dwUnitId = pPlayer === 0 ? 0xffffffff : (m.u32(pPlayer + 0x0c) >>> 0);
  SUNIT_ValidatePathTargetUnit113c(m, pPlayer, pGame);
  const pPath = m.u32(pPlayer + 0x2c);
  let pTarget = pPath !== 0 ? (PATH_GetTargetUnit113c(m, pPath) >>> 0) : 0;
  if (pTarget === (pPlayer >>> 0)) {
    pTarget = 0;
  }
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) & 0xffff;
  const nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pPlayer, pSkill, 1) & 0xff;
  if (pTarget !== 0 && UNITROOM_IsClientInUnitRoom113c(m, pTarget, pClient) !== 0) {
    NET_SendUnitTargetedSkillAction113c(
      m,
      pClient >>> 0,
      0,
      0,
      dwUnitId,
      m.u32(pTarget) & 0xff,
      m.u32(pTarget + 0x0c) >>> 0,
      nSkillId,
      0,
      nSkillLvl,
    );
    return;
  }
  const targetY = pPath !== 0 ? (PATH_GetFirstPointY113c(m, pPath) & 0xffff) : 0;
  const targetX = pPath !== 0 ? (PATH_GetFirstPointX113c(m, pPath) & 0xffff) : 0;
  const pkt = new Uint8Array(0x11);
  pkt[0x00] = 0x4d;
  pkt[0x01] = 0x00;
  pkt[0x02] = dwUnitId & 0xff;
  pkt[0x03] = (dwUnitId >>> 8) & 0xff;
  pkt[0x04] = (dwUnitId >>> 16) & 0xff;
  pkt[0x05] = (dwUnitId >>> 24) & 0xff;
  pkt[0x06] = nSkillId & 0xff;
  pkt[0x07] = (nSkillId >>> 8) & 0xff;
  pkt[0x08] = 0x00;
  pkt[0x09] = 0x00;
  pkt[0x0a] = nSkillLvl;
  pkt[0x0b] = targetX & 0xff;
  pkt[0x0c] = (targetX >>> 8) & 0xff;
  pkt[0x0d] = targetY & 0xff;
  pkt[0x0e] = (targetY >>> 8) & 0xff;
  pkt[0x0f] = 0x00;
  pkt[0x10] = 0x00;
  enqueueClientPacketBytes113c(m, pClient, pkt, 0x11);
}

// @va D2Game:0x6FD00660
export function SUNIT_CanPlayerTargetUnitWithSkill113c(
  m: Memory113c,
  pTarget: number,
  pGame: number,
  pPlayer: number,
  nSkillId: number,
): number {
  hitD2GameVa113c(0x6FD00660);
  if (pPlayer === 0 || m.u32(pPlayer) !== 0 || pTarget === 0) {
    return 0;
  }
  const targetType = m.u32(pTarget);
  if (targetType !== 1 && targetType !== 0) {
    return 0;
  }
  if (nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = safeGetSkillsTxtPtr113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  if ((m.u8(pSkillsTxt + 0x07) & 0x04) === 0) {
    return 0;
  }
  let pTargetOwner = pTarget;
  if (targetType === 1) {
    const owner = getMonsterAiOwnerIdAndType113c(m, pTarget);
    if (owner.ownerId === -1) {
      return 0;
    }
    pTargetOwner = SUNIT_GetServerUnit113c(m, pGame, owner.ownerType, owner.ownerId);
    if (pTargetOwner === 0) {
      return 0;
    }
  }
  if (pTargetOwner === pPlayer) {
    return 1;
  }
  const party1 = SUNITDMG_GetPlayerClientClassId113c(m, pPlayer) & 0xffff;
  if (party1 === 0xffff) {
    return 0;
  }
  const party2 = SUNITDMG_GetPlayerClientClassId113c(m, pTargetOwner) & 0xffff;
  return party1 === party2 ? 1 : 0;
}

// @va D2Game:0x6FD00A60
export function SUNIT_AreUnitsHostileOrUnaligned113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FD00A60);
  if (pUnit1 === 0 || pUnit2 === 0) {
    return 0;
  }
  let pRoot1 = pUnit1;
  const type1 = m.u32(pUnit1);
  if (type1 === 1) {
    const owner1 = getMonsterAiOwnerIdAndType113c(m, pUnit1);
    if (owner1.ownerId !== -1) {
      const pResolved1 = SUNIT_GetServerUnit113c(m, pGame, owner1.ownerType, owner1.ownerId);
      if (pResolved1 !== 0) {
        pRoot1 = pResolved1;
      }
    }
  }
  let pRoot2 = pUnit2;
  const type2 = m.u32(pUnit2);
  if (type2 === 1) {
    const owner2 = getMonsterAiOwnerIdAndType113c(m, pUnit2);
    if (owner2.ownerId !== -1) {
      const pResolved2 = SUNIT_GetServerUnit113c(m, pGame, owner2.ownerType, owner2.ownerId);
      if (pResolved2 !== 0) {
        pRoot2 = pResolved2;
      }
    }
  }
  if (pRoot1 === pRoot2) {
    return 0;
  }
  if (m.u32(pRoot1) === 0 && m.u32(pRoot2) === 0) {
    const id2 = m.u32(pRoot2 + 0x0c);
    if (checkPlayerPairPvpFlag113c(m, pRoot1, id2, 8) !== 0) {
      const id1 = m.u32(pRoot1 + 0x0c);
      if (checkPlayerPairPvpFlag113c(m, pRoot2, id1, 8) !== 0) {
        return 1;
      }
    }
    return 0;
  }
  return UNITS_AreUnitsAligned113c(m, pRoot2, pRoot1) === 0 ? 1 : 0;
}

// ===========================================================================
// F801 (20 VAs)
// ===========================================================================

// @va D2Game:0x6FC43220
export function MONSTER_GetSuperUniqueId113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC43220);
  if (pUnit === 0 || m.u32(pUnit) !== 1) {
    return -1;
  }
  const pMonsterData = m.u32(pUnit + 0x14);
  if (pMonsterData === 0) {
    return -1;
  }
  if ((m.u8(pMonsterData + 0x16) & 0x02) === 0) {
    return -1;
  }
  return (m.u16(pMonsterData + 0x26) << 16) >> 16;
}

// @va D2Game:0x6FC55EF0
export function QUESTS_OnMonsterKill113c(
  m: Memory113c,
  pGame: number,
  pKiller: number,
  pVictim: number,
): void {
  hitD2GameVa113c(0x6FC55EF0);
  const victim = pVictim >>> 0;
  if (victim === 0 || (m.u32((victim + 0x74) >>> 0) >>> 0) === 0) {
    return;
  }
  const game = pGame >>> 0;
  if (game === 0) {
    return;
  }
  let killer = pKiller >>> 0;
  if (m.u8((game + 0x6a) >>> 0) === 3 && killer === 0) {
    const pClient = m.u32((game + 0x88) >>> 0) >>> 0;
    if (pClient !== 0) {
      killer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0;
    }
  }

  const sp = a1cOwnerScratchPtr;
  a1cOwnerScratchPtr = (sp + 0x10) >>> 0;
  try {
    m.setU32(sp, game);
    m.setU32((sp + 0x04) >>> 0, 8);
    m.setU32((sp + 0x08) >>> 0, victim);
    m.setU32((sp + 0x0c) >>> 0, 0);

    if (killer !== 0) {
      const killerType = m.u32(killer) >>> 0;
      if (killerType === 0) {
        m.setU32((sp + 0x0c) >>> 0, killer);
      } else if (killerType === 1) {
        const owner = getMonsterAiOwnerIdAndType113c(m, killer);
        if (owner.ownerType === 0) {
          const pOwner = SUNIT_GetServerUnit113c(m, game, 0, owner.ownerId) >>> 0;
          m.setU32((sp + 0x0c) >>> 0, pOwner);
        }
      }
    }

    let bForceInactive = 0;
    if ((m.u32(victim) >>> 0) === 1) {
      const pMonData = m.u32((victim + 0x14) >>> 0) >>> 0;
      if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 2) !== 0) {
        const suId = (m.u16((pMonData + 0x26) >>> 0) << 16) >> 16;
        let monClass = -1;
        if (suId >= 0) {
          const pTables = getQuestSgptDataTablesPtr113c(m);
          if (pTables !== 0 && suId < (m.u32((pTables + 0xadc) >>> 0) | 0)) {
            const pSuBase = m.u32((pTables + 0xad4) >>> 0) >>> 0;
            if (pSuBase !== 0) {
              monClass = m.u32((pSuBase + suId * 0x34 + 0x08) >>> 0) | 0;
            }
          }
        }
        const jtIdx = (monClass - 0x1a) >>> 0;
        if (jtIdx <= 0x22 && QUEST_KILL_MONCLASS_FORCE_JT_113C[jtIdx] === 0) {
          bForceInactive = 1;
        }
      }
    }

    const victimClassId = m.u32((victim + 0x04) >>> 0) >>> 0;
    if (
      victimClassId === 0x187 ||
      victimClassId === 0xf2 ||
      victimClassId === 0xf3 ||
      victimClassId === 0x220
    ) {
      bForceInactive = 1;
    }

    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, sp, bForceInactive);
  } finally {
    a1cOwnerScratchPtr = sp;
  }
}

function invokeUnitItemEventCallback113c(
  m: Memory113c,
  pfn: number,
  pGame: number,
  nEventType: number,
  pUnit: number,
  pTarget: number,
  pDmg: number,
  dwArg1: number,
  dwArg2: number,
): number {
  const sm = m as SparseMemory113c;
  switch (pfn >>> 0) {
    case 0x6fc61fb0:
      return SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fc62b40:
      return SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c(
        sm,
        pGame,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc62c70:
      return SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(
        m,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc634e0:
      return SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc64600:
      return SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c(
        sm,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc6dfe0:
      return SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c(
        sm,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc6e500:
      return SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c(
        sm,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc6e5f0:
      return SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc6e760:
      return SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fc6ef70:
      return SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fc6f090:
      return SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fcb8a70:
      SUNITDMG_ApplyOpenWoundsAndCrushingBlowSideEffects113c(m, pTarget, pGame, pUnit, pDmg);
      return 1;
    case 0x6fccc910:
      return MONAI_EnableState172OnTarget_6FCCC910_113c(m, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fccca70:
      return ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fcccb10:
      return ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fcccba0:
      return ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fcccc30:
      return ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c(
        sm,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fcccda0:
      return ITEMEVENT_ManaAfterKill113c(m, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fccce60:
      return ITEMMODS_ApplyKnockback_6FCCCE60_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fccd2a0:
      return ITEMMODS_ApplySlowTarget_6FCCD2A0_113c(sm, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fccd410:
      return SUNITDMG_ProcHitOpenWounds_6FCCD410_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fccd580:
      return ITEMMODS_ApplyMonsterFlee_6FCCD580_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fccd6c0:
      return ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c(sm, pGame, pUnit, pTarget, pDmg, dwArg1);
    case 0x6fccd7b0:
      return ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c(
        sm,
        pGame,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
      );
    case 0x6fccd860:
      return ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c(
        sm,
        pGame,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
      );
    case 0x6fccd910:
      return ITEMEVENT_AttackerTakesDamage113c(m, pGame, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fccdbf0:
      return ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c(
        sm,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fccdce0:
      return ITEMEVENT_ChanceToCastSkill113c(m, pUnit, pTarget, pDmg, dwArg1, dwArg2);
    case 0x6fccddc0:
      return ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c(
        sm,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fcce0e0:
      return SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fcce200:
      return ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c(
        sm,
        pGame,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
        dwArg2,
      );
    case 0x6fccf210:
      return ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c(
        sm,
        pGame,
        pUnit,
        pTarget,
        pDmg,
        dwArg2,
        dwArg1,
      );
    case 0x6fccf2e0:
      return SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c(
        sm,
        pGame,
        nEventType,
        pUnit,
        pTarget,
        pDmg,
        dwArg1,
      );
    default:
      return 0;
  }
}

// @va D2Game:0x6FC57030
export function SUNIT_DispatchItemEventCallbacks113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nEventType: number,
  pTarget: number,
  pArg: number,
): number {
  hitD2GameVa113c(0x6FC57030);
  if (pUnit === 0) {
    return 0;
  }
  let pNode = m.u32((pUnit + 0x90) >>> 0) >>> 0;
  let lastRet = 0;
  while (pNode !== 0) {
    const nNodeEvent = m.u8(pNode);
    let pNext = m.u32((pNode + 0x1c) >>> 0) >>> 0;
    if (nNodeEvent === (nEventType >>> 0)) {
      const dwArg2 = m.u32((pNode + 0x10) >>> 0) >>> 0;
      const dwArg1 = m.u32((pNode + 0x0c) >>> 0) >>> 0;
      m.setU8((pNode + 0x02) >>> 0, (m.u8((pNode + 0x02) >>> 0) | 0x01) & 0xff);
      const pfn = m.u32((pNode + 0x14) >>> 0) >>> 0;
      lastRet =
        invokeUnitItemEventCallback113c(
          m,
          pfn,
          pGame >>> 0,
          nEventType | 0,
          pUnit >>> 0,
          pTarget >>> 0,
          pArg >>> 0,
          dwArg1,
          dwArg2,
        ) | 0;
      m.setU8((pNode + 0x02) >>> 0, m.u8((pNode + 0x02) >>> 0) & 0xfe);
      pNext = m.u32((pNode + 0x1c) >>> 0) >>> 0;
      if ((m.u8((pNode + 0x02) >>> 0) & 0x02) !== 0 || m.u32((pNode + 0x04) >>> 0) === 0) {
        const pPrev = m.u32((pNode + 0x18) >>> 0) >>> 0;
        if (pPrev !== 0) {
          m.setU32((pPrev + 0x1c) >>> 0, pNext);
        } else {
          m.setU32((pUnit + 0x90) >>> 0, pNext);
        }
        const pCurNext = m.u32((pNode + 0x1c) >>> 0) >>> 0;
        if (pCurNext !== 0) {
          m.setU32((pCurNext + 0x18) >>> 0, m.u32((pNode + 0x18) >>> 0) >>> 0);
        }
      }
    }
    pNode = pNext;
  }
  return lastRet;
}

// @va D2Game:0x6FC57260
export function PLAYER_SetActiveDualWeaponStatLists113c(
  m: Memory113c,
  bEnable: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC57260);
  if (bEnable === 0 || pPlayer === 0) {
    return;
  }
  const pInv = m.u32(pPlayer + 0x60);
  const pPrimary = INVENTORY_GetCompositWeaponMemPort113c(m, pInv);
  if (pPrimary !== 0) {
    STATLIST_SetWeaponStatListActive113c(m, pPlayer, pPrimary, 1);
  }
  const pSecondary = INVENTORY_GetSecondaryWeapon113c(m, pInv);
  if (pSecondary !== 0) {
    STATLIST_SetWeaponStatListActive113c(m, pPlayer, pSecondary, 0);
  }
}

// @va D2Game:0x6FC57540
export function PLAYER_UpdateDualWieldWeaponStatLists113c(
  m: Memory113c,
  bResetFirst: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC57540);
  if (pPlayer === 0) {
    return;
  }
  if (bResetFirst !== 0) {
    const pInv = m.u32(pPlayer + 0x60);
    let pItem = INVENTORY_GetFirstItem113c(m, pInv);
    while (pItem !== 0) {
      if (INVENTORY_UnitIsItem113c(m, pItem) !== 0) {
        const pItemData = m.u32(pItem + 0x14);
        const bodyLoc = pItemData !== 0 ? m.u8(pItemData + 0x45) : 0;
        if (
          (bodyLoc === 4 || bodyLoc === 5) &&
          ITEMS_GetItemTypeFromItem113c(m, pItem) !== 2
        ) {
          STATLIST_SetWeaponStatListActive113c(m, pPlayer, pItem, 0);
        }
      }
      pItem = INVENTORY_GetNextItem113c(m, pItem);
    }
  }
  if (UNITS_CanDualWield113c(m, pPlayer) === 0) {
    return;
  }
  if (m.u32(0x6fde9e1c) !== 0) {
    UNITS_SyncDualWieldWeaponStatLists113c(m, pPlayer, bResetFirst);
  }
  const pActiveWeapon = PLAYER_GetEquippedWeapon113c(m, pPlayer);
  const pInv = m.u32(pPlayer + 0x60);
  let pItem = INVENTORY_GetFirstItem113c(m, pInv);
  while (pItem !== 0) {
    if (INVENTORY_UnitIsItem113c(m, pItem) !== 0) {
      const pItemData = m.u32(pItem + 0x14);
      const bodyLoc = pItemData !== 0 ? m.u8(pItemData + 0x45) : 0;
      if (
        (bodyLoc === 4 || bodyLoc === 5) &&
        ITEMS_GetItemTypeFromItem113c(m, pItem) !== 2
      ) {
        if (pItem === pActiveWeapon) {
          STATLIST_SetWeaponStatListActive113c(m, pPlayer, pItem, 1);
        } else {
          STATLIST_SetWeaponStatListActive113c(m, pPlayer, pItem, 0);
        }
      }
    }
    pItem = INVENTORY_GetNextItem113c(m, pItem);
  }
}

// @va D2Game:0x6FCAC100
export function S2C_SendPacket0E_UnitCorpseState113c(
  m: Memory113c,
  bOpcode: number,
  dwUnitId: number,
  pClient: number,
  bAction: number,
  wCoordX: number,
  wCoordY: number,
  bFlag1: number,
  bFlag2: number,
): void {
  hitD2GameVa113c(0x6FCAC100);
  if (pClient === 0) {
    return;
  }
  // 0x6FCAC100..0x6FCAC156: exact 12-byte S2C `0x69` (`[op, dwUnitId(4), bAction, wX(2), wY(2), bFlag1, bFlag2]`).
  const pkt = new Uint8Array(0x0c);
  pkt[0x00] = bOpcode & 0xff;
  pkt[0x01] = dwUnitId & 0xff;
  pkt[0x02] = (dwUnitId >>> 8) & 0xff;
  pkt[0x03] = (dwUnitId >>> 16) & 0xff;
  pkt[0x04] = (dwUnitId >>> 24) & 0xff;
  pkt[0x05] = bAction & 0xff;
  pkt[0x06] = wCoordX & 0xff;
  pkt[0x07] = (wCoordX >>> 8) & 0xff;
  pkt[0x08] = wCoordY & 0xff;
  pkt[0x09] = (wCoordY >>> 8) & 0xff;
  pkt[0x0a] = bFlag1 & 0xff;
  pkt[0x0b] = bFlag2 & 0xff;
  enqueueClientPacketBytes113c(m, pClient, pkt, 0x0c);
}

function dispatchProgressiveSrvDoFunc113c(
  m: Memory113c,
  fnIdx: number,
  pGame: number,
  pUnit: number,
  skillId: number,
  effLvl: number,
): void {
  if (fnIdx <= 0 || fnIdx >= 0xbf) {
    return;
  }
  const pfn = m.u32((0x6fd274a8 + (fnIdx << 2)) >>> 0) >>> 0;
  if (pfn === 0) {
    return;
  }
  switch (pfn) {
    case 0x6fcb2230:
      SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    case 0x6fcb3340:
      SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    case 0x6fcb3bc0:
      SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    case 0x6fcb4970:
      SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    case 0x6fcb4e60:
      SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    case 0x6fcb4f50:
      SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    case 0x6fcb5040:
      SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c(
        m as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        skillId | 0,
        effLvl | 0,
      );
      break;
    default:
      break;
  }
}

// @va D2Game:0x6FCB1B70
export function SKILLS_ConsumeProgressiveChargesOnHit113c(
  m: Memory113c,
  pDamage: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCB1B70);
  if (pUnit === 0) {
    return;
  }
  let dmgPtr = pDamage >>> 0;
  if (dmgPtr === 0 && m.u32((pUnit + 0xac) >>> 0) !== 0) {
    const pPath0 = m.u32((pUnit + 0x2c) >>> 0) >>> 0;
    const pTgt0 = pPath0 !== 0 ? (PATH_GetTargetUnit113c(m, pPath0) >>> 0) : 0;
    if (pTgt0 !== 0) {
      dmgPtr = SUNITDMG_FindCombatDamageData113c(m, pUnit, pTgt0) >>> 0;
    }
  }
  if (dmgPtr === 0 || (m.u8((dmgPtr + 0x04) >>> 0) & 0x01) === 0) {
    return;
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0;
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0;
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return;
  }
  UNITS_IsInMovingMode113c(m, pTarget);
  if (UNITS_CanUnitMeleeAttackTarget113c(m, pUnit, pTarget, 0) === 0) {
    return;
  }
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0;
  const pDataTables = pDataTablesPtr !== 0 ? (m.u32(pDataTablesPtr) >>> 0) : 0;
  const nProgCount = pDataTables !== 0 ? ((m.u16((pDataTables + 0x170) >>> 0) << 16) >> 16) : 0;
  if (nProgCount > 0) {
    const spSeed = a1cPost150AttackStackPtr;
    a1cPost150AttackStackPtr = (spSeed + 8) >>> 0;
    try {
      const pMasks = m.u32(0x6fd18be0) >>> 0;
      const prgStackMask = pMasks !== 0 ? m.u8((pMasks + 0x1c) >>> 0) : 0x80;
      for (let i = 0; ; ) {
        const dtCur = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
        const pProgStates = m.u32((dtCur + 0x16c) >>> 0) >>> 0;
        const stateId = (m.u16((pProgStates + ((i * 2) | 0)) >>> 0) << 16) >> 16;
        if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
          const dtState = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
          const pProgStates2 = m.u32((dtState + 0x16c) >>> 0) >>> 0;
          const stateId2 = (m.u16((pProgStates2 + ((i * 2) | 0)) >>> 0) << 16) >> 16;
          const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId2) >>> 0;
          if (pStatList !== 0) {
            const skillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0;
            const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0;
            if (pSkillsTxt !== 0) {
              const storedLvl = STATLIST_GetStatValue113c(m, pStatList, 0x15f, 0) | 0;
              const pSkillObj = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
                m,
                pUnit,
                skillId,
              ) >>> 0;
              const evalLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkillObj, 1) | 0;
              const effLvl = evalLvl > storedLvl ? evalLvl : storedLvl;
              if (effLvl > 0) {
                const wAuraStat1 = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16;
                const dtStat = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
                const nStatCount = m.u32((dtStat + 0xbd4) >>> 0) | 0;
                if (wAuraStat1 >= 0 && wAuraStat1 < nStatCount) {
                  const charges = STATLIST_GetStatValue113c(m, pStatList, wAuraStat1, 0) | 0;
                  const stacks = charges <= 1 ? 1 : charges >= 3 ? 3 : charges;
                  const pSeed = (pUnit + 0x20) >>> 0;
                  SEED_GetSeeds113c(m, pSeed, spSeed, (spSeed + 4) >>> 0);
                  const origLo = m.u32(spSeed) >>> 0;
                  const origHi = m.u32((spSeed + 4) >>> 0) >>> 0;
                  const rolledLo = SEED_StepSeed64Fast_6FC21160_113c(m, pSeed) >>> 0;
                  SEED_SetSeeds113c(m, pSeed, origLo, origHi);
                  const idx = (stacks - 1) | 0;
                  if ((m.u8((pSkillsTxt + 0x04) >>> 0) & prgStackMask) !== 0) {
                    for (let j = 0; j < idx; j = (j + 1) | 0) {
                      const fnIdx = (m.u16((pSkillsTxt + 0x30 + ((j * 2) | 0)) >>> 0) << 16) >> 16;
                      if (fnIdx > 0 && fnIdx < 0xbf) {
                        STATLIST_SetStat113c(m, pStatList, wAuraStat1, (j + 1) | 0, 0);
                        dispatchProgressiveSrvDoFunc113c(m, fnIdx, pGame, pUnit, skillId, effLvl);
                      }
                    }
                    STATLIST_SetStat113c(m, pStatList, wAuraStat1, (idx + 1) | 0, 0);
                  }
                  const finalFnIdx = (m.u16((pSkillsTxt + 0x30 + ((idx * 2) | 0)) >>> 0) << 16) >> 16;
                  if (finalFnIdx > 0 && finalFnIdx < 0xbf) {
                    dispatchProgressiveSrvDoFunc113c(m, finalFnIdx, pGame, pUnit, skillId, effLvl);
                  }
                  UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(
                    m,
                    pUnit,
                    pTarget,
                    skillId,
                    effLvl,
                    rolledLo,
                    0,
                    stacks,
                  );
                }
              }
            }
            STATLIST_UnlinkSubList113c(m, pUnit, pStatList);
            STATLIST_FreeStatListIfNonExtended113c(m, pStatList);
          }
        }
        const dtNext = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
        const nProgCur = (m.u16((dtNext + 0x170) >>> 0) << 16) >> 16;
        i = (i + 1) | 0;
        if (i >= nProgCur) {
          break;
        }
      }
    } finally {
      a1cPost150AttackStackPtr = spSeed;
    }
  }
  UNITS_TransferStateMaskDCToRemoved113c(m, pUnit);
}

// @va D2Game:0x6FCB1E30
export function SKILLS_ApplyProgressiveChargesToDamage113c(
  m: Memory113c,
  pUnit: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCB1E30);
  if (pDmg === 0 || (m.u8((pDmg + 0x04) >>> 0) & 1) === 0) {
    return;
  }
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0;
  let pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0;
  if (pDataTables === 0) {
    return;
  }
  let nProgCount = (m.u16((pDataTables + 0x170) >>> 0) << 16) >> 16;
  for (let i = 0; i < nProgCount; i = (i + 1) | 0) {
    const pProgStates = m.u32((pDataTables + 0x16c) >>> 0) >>> 0;
    const stateId = (m.u16((pProgStates + ((i * 2) | 0)) >>> 0) << 16) >> 16;
    if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
      const pDt2 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
      const pProgStates2 = m.u32((pDt2 + 0x16c) >>> 0) >>> 0;
      const stateId2 = (m.u16((pProgStates2 + ((i * 2) | 0)) >>> 0) << 16) >> 16;
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId2) >>> 0;
      if (pStatList !== 0) {
        const skillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0;
        const pDt3 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
        if (skillId > 0 && skillId < (m.u32((pDt3 + 0xba0) >>> 0) | 0)) {
          const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0;
          if (pSkillsTxt !== 0) {
            const bPrgCalc = m.u8((pSkillsTxt + 0x44) >>> 0);
            if (bPrgCalc === 2) {
              SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c(m, pUnit, pStatList, pDmg);
            } else if (bPrgCalc === 3) {
              SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c(
                m,
                pUnit,
                pStatList,
                pDmg,
              );
            } else if (bPrgCalc === 4) {
              SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c(
                m,
                pUnit,
                pDmg,
                pStatList,
              );
            }
          }
        }
      }
    }
    pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
    nProgCount = (m.u16((pDataTables + 0x170) >>> 0) << 16) >> 16;
  }
}

// @va D2Game:0x6FCB22A0
export function SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(
  m: Memory113c,
  pUnit: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCB22A0);
  if (pDmg === 0 || (m.u8((pDmg + 0x04) >>> 0) & 1) === 0) {
    return;
  }
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0;
  let pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0;
  if (pDataTables === 0) {
    return;
  }
  let nProgCount = (m.u16((pDataTables + 0x170) >>> 0) << 16) >> 16;
  for (let i = 0; i < nProgCount; i = (i + 1) | 0) {
    const pProgStates = m.u32((pDataTables + 0x16c) >>> 0) >>> 0;
    const stateId = (m.u16((pProgStates + ((i * 2) | 0)) >>> 0) << 16) >> 16;
    if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
      const pDt2 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
      const pProgStates2 = m.u32((pDt2 + 0x16c) >>> 0) >>> 0;
      const stateId2 = (m.u16((pProgStates2 + ((i * 2) | 0)) >>> 0) << 16) >> 16;
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId2) >>> 0;
      if (pStatList !== 0) {
        const skillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0;
        const pDt3 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
        if (skillId > 0 && skillId < (m.u32((pDt3 + 0xba0) >>> 0) | 0)) {
          const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0;
          if (pSkillsTxt !== 0 && m.u8((pSkillsTxt + 0x44) >>> 0) === 1) {
            SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c(m, pUnit, pStatList, pDmg);
          }
        }
      }
    }
    pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0;
    nProgCount = (m.u16((pDataTables + 0x170) >>> 0) << 16) >> 16;
  }
}

// @va D2Game:0x6FCB8A70
export function SUNITDMG_ApplyOpenWoundsAndCrushingBlowSideEffects113c(
  m: Memory113c,
  pAttacker: number,
  pGame: number,
  pDefender: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCB8A70);
  if (pDefender === 0 || pDmg === 0) {
    return;
  }
  const att = pAttacker >>> 0;
  const def = pDefender >>> 0;
  const game = pGame >>> 0;
  const dmg = pDmg >>> 0;
  let thornsPct = STATLIST_GetUnitStat113c(m, def, 0x83, 0) | 0;
  if (thornsPct <= 0) {
    return;
  }
  if (att !== 0 && (m.u32(att) === 0 || MONSTERS_GetHirelingTypeId113c(m, att) !== 0)) {
    thornsPct = ((thornsPct + 4) / 8) | 0;
  }
  if (thornsPct <= 0) {
    return;
  }
  const physDmg = m.u32((dmg + 0x08) >>> 0) | 0;
  let reflectedPhys = 0;
  if (physDmg > 0x100000) {
    if ((physDmg & ~0x0f) < 0x640) {
      reflectedPhys = Number((BigInt(physDmg) * BigInt(thornsPct)) / 100n) | 0;
    } else {
      reflectedPhys = Math.imul(Math.trunc(physDmg / 100) | 0, thornsPct) | 0;
    }
  } else if (thornsPct > 0x10000) {
    if ((thornsPct & ~0x0f) < 0x640) {
      reflectedPhys = Number((BigInt(physDmg) * BigInt(thornsPct)) / 100n) | 0;
    } else {
      reflectedPhys = Math.imul(Math.trunc(thornsPct / 100) | 0, physDmg) | 0;
    }
  } else {
    reflectedPhys = Math.trunc((Math.imul(physDmg, thornsPct) | 0) / 100) | 0;
  }
  const sp = a1cPost150AttackStackPtr;
  a1cPost150AttackStackPtr = (sp + 0x70) >>> 0;
  try {
    m.fill(sp, 0x70, 0);
    m.setU32((sp + 0x08) >>> 0, reflectedPhys >>> 0);
    m.setU16((sp + 0x04) >>> 0, 0x4021);
    m.setU32((sp + 0x60) >>> 0, 0x8d);
    SUNITDMG_ApplyDamage113c(m, game, def, att, sp, 1);
    SUNITDMG_ApplySideEffectsAndKill113c(m, game, def, att, sp);
  } finally {
    a1cPost150AttackStackPtr = sp;
  }
}

// @va D2Game:0x6FCBC000
export function PARTY_CountLivingPartyMemberCallback113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pCountOut: number,
): void {
  hitD2GameVa113c(0x6FCBC000);
  void pGame;
  if (pUnit !== 0 && SUNIT_IsDeadOrDying113c(m, pUnit) === 0) {
    m.setU32(pCountOut, ((m.u32(pCountOut) + 1) | 0) >>> 0);
  }
}

// @va D2Game:0x6FCBC070
export function PARTY_ForEachPartyMemberInSameLevel113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
  pfnCallback: (m: Memory113c, pGame: number, pMemberUnit: number, pArg: number) => void,
  pArg: number,
): void {
  hitD2GameVa113c(0x6FCBC070);
  const pPlayerRoom = pPlayer !== 0 ? UNITS_GetRoom113c(m, pPlayer) : 0;
  if (pPlayerRoom === 0) {
    pfnCallback(m, pGame, pPlayer, pArg);
    return;
  }
  const playerLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pPlayerRoom);
  const pUnitGame = pPlayer !== 0 ? (m.u32((pPlayer + 0x80) >>> 0) >>> 0) : 0;
  if (pPlayer === 0 || pUnitGame === 0 || m.u32(pPlayer) !== 0) {
    pfnCallback(m, pGame, pPlayer, pArg);
    return;
  }
  const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayer, pUnitGame) & 0xffff;
  if (wPartyId === 0xffff) {
    pfnCallback(m, pGame, pPlayer, pArg);
    return;
  }
  if (pGame === 0 || (m.u32((pGame + 0x1d2c) >>> 0) >>> 0) === 0) {
    return;
  }
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame, wPartyId) >>> 0;
  if (pSubParty === 0) {
    return;
  }
  let pMember = m.u32((pSubParty + 0x04) >>> 0) >>> 0;
  while (pMember !== 0) {
    const memberUnitId = m.u32(pMember) >>> 0;
    const pMemberUnit = SUNIT_GetServerUnit113c(m, pGame, 0, memberUnitId);
    if (pMemberUnit !== 0) {
      const pMemberRoom = UNITS_GetRoom113c(m, pMemberUnit);
      if (pMemberRoom !== 0) {
        const memberLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pMemberRoom);
        if (memberLevelId === playerLevelId) {
          pfnCallback(m, pGame, pMemberUnit, pArg);
        }
      }
    }
    pMember = m.u32((pMember + 0x04) >>> 0) >>> 0;
  }
}

// @va D2Game:0x6FCBC1F0
export function PARTY_CountLivingPartyMembersInSameLevel113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCBC1F0);
  const scratchCountPtr = 0x004ff020;
  m.setU32(scratchCountPtr, 0);
  PARTY_ForEachPartyMemberInSameLevel113c(
    m,
    pPlayer,
    pGame,
    PARTY_CountLivingPartyMemberCallback113c,
    scratchCountPtr,
  );
  return (m.u32(scratchCountPtr) | 0);
}

// @va D2Game:0x6FCBF3B0
export function SKILLS_SetSkillDelayTimer113c(
  m: Memory113c,
  nSkillId: number,
  pGame: number,
  pUnit: number,
  nSkillLevel: number,
  bResetExisting: number,
): number {
  hitD2GameVa113c(0x6FCBF3B0);
  if (pGame === 0 || pUnit === 0 || nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  const delayFlags = m.u8(pSkillsTxt + 0x04) & 0x60;
  if (delayFlags === 0) {
    return 0;
  }
  const delayCalc = m.u32((pSkillsTxt + 0x128) >>> 0);
  let delayFrames = SKILLS_EvalCalcByOffset113c(m, pUnit, delayCalc, nSkillId, nSkillLevel);
  if (delayFrames <= 5) {
    delayFrames = 5;
  }
  const curFrame = m.u32(pGame + 0xa8) | 0;
  const expireFrame =
    (Math.imul(Math.trunc(((curFrame + delayFrames - 1) | 0) / delayFrames) | 0, delayFrames) + 1) |
    0;
  if (bResetExisting === 0) {
    EVENT_SetEventFull113c(m, pGame, pUnit, 8, expireFrame, 0, nSkillId, nSkillLevel);
    return 1;
  }
  for (let cur = m.u32((pUnit + 0xdc) >>> 0); cur !== 0; ) {
    const next = m.u32((cur + 0x24) >>> 0);
    if (m.u8(cur >>> 0) === 8 && (m.u32((cur + 0x14) >>> 0) | 0) === -1) {
      EVENT_FreeNode113c(m, pGame, cur);
    }
    cur = next;
  }
  EVENT_SetEventFull113c(m, pGame, pUnit, 8, expireFrame, 0, -1, 0);
  return 1;
}

// @va D2Game:0x6FCC19A0
export function SKILLS_ExecuteSkillDoFunc113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nSkillLevel: number,
  bConsumeMana: number,
  bCheckItem: number,
  bUseAltFunc: number,
  onSrvDoFunc?: (wDoFuncIdx: number, nSkillId: number, effLevel: number) => number,
  combatHooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCC19A0);
  if (pGame === 0 || pUnit === 0) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0 || nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = safeGetSkillsTxtPtr113c(
    m,
    nSkillId,
    SKILLS_GetUsedSkillMemPort113c(m, pUnit),
  );
  if (pSkillsTxt === 0) {
    return 0;
  }
  if ((m.u8(pSkillsTxt + 0x05) & 0x01) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
      return 0;
    }
  }
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  let effLevel = nSkillLevel;
  let bNoMana = bConsumeMana === 0 ? 1 : 0;
  if (bCheckItem !== 0 && bUseAltFunc === 0 && pUsedSkill !== 0) {
    const scratchBase = 0x004ff040;
    if (
      SKILLS_GetItemSkillInfo113c(
        m,
        pUsedSkill,
        scratchBase,
        scratchBase + 4,
        scratchBase + 8,
        scratchBase + 12,
      ) !== 0
    ) {
      if ((m.u32(scratchBase + 12) | 0) <= 0) {
        return 0;
      }
      effLevel = (m.u32(scratchBase + 8) | 0);
      bNoMana = 1;
    }
  }
  if (
    bNoMana === 0 &&
    (m.u8(pSkillsTxt + 0x08) & 0x20) !== 0 &&
    SKILLS_CheckSkillManaAndCharges113c(m, pUnit) === 0
  ) {
    return 0;
  }
  const srvDoFunc2e = (m.u16(pSkillsTxt + 0x2e) << 16) >> 16;
  let wDoFuncIdx =
    srvDoFunc2e !== 0
      ? srvDoFunc2e
      : bUseAltFunc !== 0
        ? (m.u16(pSkillsTxt + 0x0c) << 16) >> 16
        : (m.u16(pSkillsTxt + 0x0a) << 16) >> 16;
  if (srvDoFunc2e !== 0 && bUseAltFunc !== 0 && bCheckItem !== 0) {
    const itemEffect = (m.u16(pSkillsTxt + 0x16a) << 16) >> 16;
    if (itemEffect > 1) {
      wDoFuncIdx = itemEffect;
    }
  }
  let doResult = 1;
  if (wDoFuncIdx > 0 && wDoFuncIdx < 0xbf) {
    if (wDoFuncIdx === 1) {
      doResult = SrvDoFunc_001_Attack113c(m, pGame, pUnit, nSkillId, effLevel, combatHooks);
    } else if (wDoFuncIdx === 20) {
      doResult = SrvDoFunc_020_StaticField113c(m, pGame, pUnit, nSkillId, effLevel);
    } else if (wDoFuncIdx === 65) {
      doResult = SrvDoFunc_065_AuraRadialStatBuff113c(m, pGame, pUnit, nSkillId, effLevel);
    } else if (onSrvDoFunc !== undefined) {
      doResult = onSrvDoFunc(wDoFuncIdx, nSkillId, effLevel);
    }
  }
  if (doResult === 0) {
    return 0;
  }
  const wSrvStFunc = (m.u16(pSkillsTxt + 0x2c) << 16) >> 16;
  if (bNoMana === 0 && (wSrvStFunc === 0 || (m.u8(pSkillsTxt + 0x08) & 0x20) !== 0)) {
    SKILLS_ConsumeSkillManaOrCharge113c(m, pUnit, nSkillId, pGame, effLevel);
  }
  const delayCalc = m.u32((pSkillsTxt + 0x190) >>> 0);
  const delay = SKILLS_EvalCalcByOffset113c(m, pUnit, delayCalc, nSkillId, effLevel);
  if (delay > 0 && (m.u32(pUnit >>> 0) | 0) === 0) {
    if (
      m.u8((pSkillsTxt + 0x10) >>> 0) !== 0x12 ||
      (m.u32((pUnit + 0x38) >>> 0) & 0xffffff00) === 0
    ) {
      const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + (delay | 0)) >>> 0;
      let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 0x79) >>> 0;
      if (pStatList === 0) {
        const dwOwnerId = m.u32((pUnit + 0x0c) >>> 0) >>> 0;
        const dwOwnerType = m.u32(pUnit >>> 0) >>> 0;
        pStatList = STATLIST_AllocList113c(m, 2, dwOwnerType, dwOwnerId, 0, expireFrame) >>> 0;
        if (pStatList !== 0) {
          STATLIST_SetState113c(m, pStatList, 0x79);
          STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0);
          STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1);
          STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x79, 1);
        }
      }
      if (pStatList !== 0) {
        STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame);
        EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, expireFrame, 0, 0, 0);
      }
    }
  }
  return doResult;
}

// @va D2Game:0x6FCC2060
export function SKILLS_DoUsedSkillAction113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  onSrvDoFunc?: (wDoFuncIdx: number, nSkillId: number, effLevel: number) => number,
  combatHooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCC2060);
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pSkill === 0) {
    return 0;
  }
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0);
  if (nSkillId < 0) {
    return 0;
  }
  const nSkillLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1);
  const bCheckItem = onSrvDoFunc !== undefined ? 1 : 0;
  const res = SKILLS_ExecuteSkillDoFunc113c(
    m,
    pUnit,
    pGame,
    nSkillId,
    nSkillLevel,
    1,
    bCheckItem,
    0,
    onSrvDoFunc,
    combatHooks,
  );
  const delayRes = SKILLS_SetSkillDelayTimer113c(m, nSkillId, pGame, pUnit, nSkillLevel, 0);
  return onSrvDoFunc !== undefined ? res : delayRes;
}

let a1cPost150AttackStackPtr = 0x7fd40000;

// @va D2Game:0x6FCC2C40
export function SrvDoFunc_001_Attack113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCC2C40);
  if (pAttacker === 0) return 0;
  m.setU32((pAttacker + 0xc4) >>> 0, (m.u32((pAttacker + 0xc4) >>> 0) | 0x40) >>> 0);
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pAttacker) >>> 0;
  if (pWeapon !== 0 && (ITEMS_GetItemTypeFromItem113c(m, pWeapon) | 0) === 0x26) {
    return 0;
  }
  if (COMPOSIT_IsUnitUsingBowOrCrossbow113c(m, pAttacker) !== 0) {
    const sp = a1cPost150AttackStackPtr;
    a1cPost150AttackStackPtr = (sp + 0x10) >>> 0;
    try {
      m.setU32(sp, nSkillLevel >>> 0);
      const missileId = SKILLS_GetWeaponMasteryPassiveStatId113c(m, pAttacker, sp) | 0;
      const effSkillLevel = m.u32(sp) | 0;
      if (missileId === 0x1b) {
        SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
          m as SparseMemory113c,
          pGame,
          0x1b,
          pAttacker,
          nSkillId,
          effSkillLevel,
          0,
          0,
          0,
          0,
          0,
        );
        return 1;
      }
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m as SparseMemory113c,
        pGame,
        missileId,
        pAttacker,
        nSkillId,
        effSkillLevel,
        0,
        0,
        0,
        0,
        1,
      );
      return 1;
    } finally {
      a1cPost150AttackStackPtr = sp;
    }
  }
  if (pAttacker === 0) {
    return 0;
  }
  SUNIT_ValidatePathTargetUnit113c(m, pAttacker, pGame);
  const pPath = m.u32((pAttacker + 0x2c) >>> 0) >>> 0;
  const pDefender = PATH_GetTargetUnit113c(m, pPath) >>> 0;
  if (pDefender === (pAttacker >>> 0) || pDefender === 0) {
    return 0;
  }
  const spDmg = a1cPost150AttackStackPtr;
  a1cPost150AttackStackPtr = (spDmg + 0x80) >>> 0;
  try {
    m.fill(spDmg, 0x70, 0);
    const toHitBonus = STATLIST_GetUnitStat113c(m, pAttacker, 0x145, 0) | 0;
    const wResultFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
      m,
      pAttacker,
      pDefender,
      pGame,
      toHitBonus,
      0,
      spDmg,
    );
    m.setU16((spDmg + 0x04) >>> 0, wResultFlags & 0xffff);
    m.setU32(spDmg, (m.u32(spDmg) | 0x02) >>> 0);
    SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(m, pAttacker, spDmg);
    SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, spDmg, 0, 0x80, 1);
    SKILLS_ApplyProgressiveChargesToDamage113c(m, pAttacker, spDmg);
    SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, spDmg, 0x80);
    if (STATES_CheckStateMaskByIndexOnUnit113c(m, pAttacker, 0x26) !== 0) {
      SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c(m, pGame, pAttacker);
      return 1;
    }
    const pDmgFound = SUNITDMG_FindCombatDamageData113c(m, pAttacker, pDefender) >>> 0;
    if (pDmgFound !== 0) {
      SKILLS_ConsumeProgressiveChargesOnHit113c(m, pDmgFound, pAttacker, pGame);
    }
    SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, 0, hooks);
    return 1;
  } finally {
    a1cPost150AttackStackPtr = spDmg;
  }
}

// @va D2Game:0x6FCCF8D0
export function MONSTER_DeleteAiAndRegenEvents113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCCF8D0);
  if (pUnit === 0) {
    return;
  }
  let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0;
  while (pEv !== 0) {
    const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0;
    if (m.u8(pEv) === 2) {
      EVENT_FreeNode113c(m, pGame, pEv);
    }
    pEv = pNext;
  }
  pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0;
  while (pEv !== 0) {
    const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0;
    if (m.u8(pEv) === 3) {
      EVENT_FreeNode113c(m, pGame, pEv);
    }
    pEv = pNext;
  }
}

// @va D2Game:0x6FCD23D0
export function ARENA_GetPlayerArenaFlags113c(
  m: Memory113c,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCD23D0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  if (pPlayerData === 0) {
    return 0;
  }
  const pArenaUnit = m.u32(pPlayerData + 0x34);
  if (pArenaUnit === 0) {
    return 0;
  }
  return m.u32(pArenaUnit + 0x04);
}

function applyArenaScoreInlined113c(
  m: Memory113c,
  pGame: number,
  pScoreUnit: number,
  nScoreType: number,
  pOtherUnit: number,
  pRefreshUnit: number,
): void {
  if (pScoreUnit === 0 || (m.u32(pScoreUnit >>> 0) | 0) !== 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x73);
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pScoreUnit) >>> 0;
  const pArenaUnit = pPlayerData !== 0 ? m.u32((pPlayerData + 0x34) >>> 0) >>> 0 : 0;
  if (pArenaUnit === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x77);
  }
  const pGameArena = m.u32((pGame + 0x1d28) >>> 0) >>> 0;
  if (pGameArena === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x6c);
  }
  const nArenaId = m.u32((pGameArena + 0x04) >>> 0) | 0;
  const pArenaTxt = DATATBLS_GetArenaTxtRecord113c(m, nArenaId) >>> 0;
  let delta = m.u32((pArenaTxt + ((nScoreType & 7) << 2)) >>> 0) | 0;
  if (nScoreType === 5) {
    const pOtherData = UNITS_GetPlayerData113c(m, pOtherUnit) >>> 0;
    const pOtherArena = pOtherData !== 0 ? m.u32((pOtherData + 0x34) >>> 0) >>> 0 : 0;
    if (pOtherArena === 0) {
      throw new D2CommonAssertError('Arena.cpp', 0x8c);
    }
    const prod = Math.imul(delta, m.u32(pOtherArena >>> 0) | 0) | 0;
    delta = Math.trunc(prod / 100) | 0;
  }
  m.setU32(pArenaUnit >>> 0, ((m.u32(pArenaUnit >>> 0) | 0) + delta) >>> 0);
  m.setU32((pArenaUnit + 0x04) >>> 0, 1);
  const pGameArenaAfter = m.u32((pGame + 0x1d28) >>> 0) >>> 0;
  if (pGameArenaAfter === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x94);
  }
  m.setU32(
    (pGameArenaAfter + 0x08) >>> 0,
    (m.u32((pGameArenaAfter + 0x08) >>> 0) | 0x400) >>> 0,
  );
  UNITROOM_RefreshUnit113c(m, pRefreshUnit >>> 0);
}

// @va D2Game:0x6FCD2940
export function ARENA_ProcessKillScoreUpdate113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pVictim: number,
): void {
  hitD2GameVa113c(0x6FCD2940);
  if (pGame === 0) {
    return;
  }
  const pg = pGame >>> 0;
  const att = pAttacker >>> 0;
  const vic = pVictim >>> 0;
  const pArenaCtrl = m.u32((pg + 0x1d28) >>> 0) >>> 0;
  if (pArenaCtrl === 0) {
    return;
  }
  const attackerType = att !== 0 ? (m.u32(att) | 0) : 6;
  if (attackerType === 1) {
    if (vic === 0 || (m.u32(vic) | 0) !== 0) {
      return;
    }
    applyArenaScoreInlined113c(m, pg, vic, 6, vic, att);
    return;
  }
  if (attackerType !== 0) {
    return;
  }
  const pKillerData = UNITS_GetPlayerData113c(m, att) >>> 0;
  const pKillerArena = pKillerData !== 0 ? m.u32((pKillerData + 0x34) >>> 0) >>> 0 : 0;
  if (pKillerArena === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0xac);
  }
  if (att === vic) {
    ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, att, 0, pg, att);
    return;
  }
  if (vic === 0) {
    return;
  }
  const victimType = m.u32(vic) | 0;
  if (victimType === 0) {
    applyArenaScoreInlined113c(m, pg, att, 1, vic, vic);
    ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, att, 2, pg, vic);
    applyArenaScoreInlined113c(m, pg, vic, 4, att, att);
    applyArenaScoreInlined113c(m, pg, vic, 5, att, att);
  } else if (victimType === 1) {
    applyArenaScoreInlined113c(m, pg, att, 3, vic, vic);
  }
}

// ===========================================================================
// F810 (1 VA)
// ===========================================================================

// @va D2Game:0x6FC97E00
export function MONSTER_IsNextModeEndWithin5Frames113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC97E00);
  if (pGame === 0) {
    return 0;
  }
  const nextFrame = EVENT_GetNextEventFrame113c(m, pUnit, 1);
  const curFrame = (m.u32(pGame + 0xa8) | 0);
  return curFrame <= ((nextFrame + 5) | 0) ? 1 : 0;
}

// ===========================================================================
// F1032 (1 VA)
// ===========================================================================

// @va D2Game:0x6FCAC090
export function S2C_SendPacket0D_UnitStop113c(
  m: Memory113c,
  bOpcode: number,
  dwUnitId: number,
  pClient: number,
  bAction: number,
  bTargetType: number,
  dwTargetId: number,
  bExtra11: number,
  wPosX: number,
  wPosY: number,
): void {
  hitD2GameVa113c(0x6FCAC090);
  if (pClient === 0) {
    return;
  }
  // 0x6FCAC090..0x6FCAC0F2: exact 16-byte S2C `0x6C` (`[op, dwUnitId(4), bAction, bTargetType, dwTargetId(4), bExtra11, wPosX(2), wPosY(2)]`).
  const pkt = new Uint8Array(0x10);
  pkt[0x00] = bOpcode & 0xff;
  pkt[0x01] = dwUnitId & 0xff;
  pkt[0x02] = (dwUnitId >>> 8) & 0xff;
  pkt[0x03] = (dwUnitId >>> 16) & 0xff;
  pkt[0x04] = (dwUnitId >>> 24) & 0xff;
  pkt[0x05] = bAction & 0xff;
  pkt[0x06] = bTargetType & 0xff;
  pkt[0x07] = dwTargetId & 0xff;
  pkt[0x08] = (dwTargetId >>> 8) & 0xff;
  pkt[0x09] = (dwTargetId >>> 16) & 0xff;
  pkt[0x0a] = (dwTargetId >>> 24) & 0xff;
  pkt[0x0b] = bExtra11 & 0xff;
  pkt[0x0c] = wPosX & 0xff;
  pkt[0x0d] = (wPosX >>> 8) & 0xff;
  pkt[0x0e] = wPosY & 0xff;
  pkt[0x0f] = (wPosY >>> 8) & 0xff;
  enqueueClientPacketBytes113c(m, pClient, pkt, 0x10);
}

// ===========================================================================
// F1040 (4 VAs)
// ===========================================================================

let a1cF1040StackPtr = 0x7ec90000;

// @va D2Game:0x6FCAC890
export function ITEMS_SyncSocketedSubItemsToClient113c(
  m: Memory113c,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): number {
  hitD2GameVa113c(0x6FCAC890);
  if (ITEMS_GetSubTypeFromItem113c(m, pItem) === 0) {
    return 0;
  }
  if (ITEMS_TestFlagMask113c(m, nCmdFlags >>> 0, 0x20) !== 0) {
    return 0;
  }
  const pInv = m.u32((pItem + 0x60) >>> 0) >>> 0;
  if (pInv === 0) {
    return 0;
  }
  let pSubItem = INVENTORY_GetFirstItem113c(m, pInv) >>> 0;
  if (pSubItem === 0) {
    return 1;
  }
  const sp = a1cF1040StackPtr;
  a1cF1040StackPtr = (sp + 8) >>> 0;
  try {
    m.setU32(sp, nCmdFlags >>> 0);
    while (pSubItem !== 0) {
      const pVerified = INVENTORY_UnitIsItem113c(m, pSubItem) >>> 0;
      ITEMS_SetOrClearFlagMask113c(m, sp, 0x08, 1);
      const updatedFlags = m.u32(sp) >>> 0;
      NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(
        m,
        0x13,
        pItem >>> 0,
        pVerified,
        pClient >>> 0,
        updatedFlags,
        0,
      );
      pSubItem = INVENTORY_GetNextItem113c(m, pSubItem) >>> 0;
    }
  } finally {
    a1cF1040StackPtr = sp;
  }
  return 1;
}

// @va D2Game:0x6FCAD3D0
export function S2C_SendPacket9C_ItemActionWorld113c(
  m: Memory113c,
  pClient: number,
  pItem: number,
  bAction: number,
  nCmdFlags: number,
  bFlag: number,
): void {
  hitD2GameVa113c(0x6FCAD3D0);
  if (pClient === 0 || pItem === 0) {
    return;
  }
  const pGame = m.u32(pClient + 0x1a8);
  let pClientPlayer = 0;
  if ((m.u8(pClient + 0x3d4) & 0x01) !== 0) {
    pClientPlayer = m.u32(pClient + 0x174);
  } else {
    pClientPlayer = m.u32(pClient + 0x174);
    if (pClientPlayer !== 0 && pGame !== 0) {
      const clientUnitType = m.u32(pClient + 0x16c);
      const clientUnitId = m.u32(pClient + 0x170);
      pClientPlayer = SUNIT_GetServerUnit113c(m, pGame, clientUnitType, clientUnitId);
      if (pClientPlayer === 0) {
        m.setU32(pClient + 0x174, 0);
      }
    }
  }

  const scratchPktBuf = 0x004ff410;
  m.fill(scratchPktBuf, 0x100, 0);
  m.setU8(scratchPktBuf + 0x00, 0x9c);
  m.setU8(scratchPktBuf + 0x01, bAction & 0xff);
  const equipLoc =
    pClientPlayer !== 0 ? INVENTORY_GetItemEquipLocation113c(m, pClientPlayer, pItem) & 0xff : 0;
  m.setU8(scratchPktBuf + 0x03, equipLoc);
  m.setU32(scratchPktBuf + 0x04, m.u32(pItem + 0x0c));

  const savedFlags = ITEMS_GetCommandFlags113c(m, pItem) >>> 0;
  ITEMS_SetOrClearCommandFlags113c(m, pItem, nCmdFlags >>> 0, 1);
  const nSerialized =
    ITEMS_SerializeItemToBuffer113c(
      m,
      pItem,
      (scratchPktBuf + 0x08) >>> 0,
      0xf4,
      0,
      0,
      bFlag | 0,
    ) | 0;
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0xffffffff, 0);
  ITEMS_SetOrClearCommandFlags113c(m, pItem, savedFlags, 1);

  if (nSerialized > 0) {
    const pktLen = (nSerialized + 8) & 0xff;
    m.setU8(scratchPktBuf + 0x02, pktLen);
    const pktBytes = new Uint8Array(pktLen);
    for (let i = 0; i < pktLen; i = (i + 1) | 0) {
      pktBytes[i] = m.u8(scratchPktBuf + i);
    }
    enqueueClientPacketBytes113c(m, pClient, pktBytes, pktLen);
  }
  ITEMS_SyncSocketedSubItemsToClient113c(m, pClient, pItem, nCmdFlags >>> 0);
}

// @va D2Game:0x6FCF40F0
export function UNITROOM_SendDroppedGroundItemToClient113c(
  m: Memory113c,
  pItem: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCF40F0);
  if (pItem === 0) {
    return;
  }
  const dwFlags = m.u32(pItem + 0xc4);
  if (((dwFlags >>> 4) & 1) !== 0) {
    return;
  }
  const dwMode = m.u32(pItem + 0x10);
  if (dwMode !== 3) {
    return;
  }
  const pPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0;
  const isDropToGround = ((dwFlags >>> 12) & 1) !== 0;
  if (pPlayer !== 0) {
    if (isDropToGround) {
      ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, pPlayer, pClient, pItem, 0);
    } else {
      ITEMS_SendGroundItemPacket03_6FCADFD0_113c(m, pPlayer, pClient, pItem, 0);
    }
    return;
  }
  const bAction = isDropToGround ? 2 : 3;
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pItem, bAction, 0, 0);
}

// @va D2Game:0x6FCF4550
export function UNITROOM_BroadcastGroundItemIfUpdated113c(
  m: Memory113c,
  pItem: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCF4550);
  if (pItem !== 0 && (m.u32(pItem + 0xc4) & 0x01) !== 0) {
    UNITROOM_SendDroppedGroundItemToClient113c(m, pItem, pClient);
  }
}

export {
  UNITS_IsInMovingMode113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  SEED_GetSeeds113c,
  SEED_SetSeeds113c,
  SKILLS_SetUsedSkillMemPort113c,
  PLAYER_StartModeAtCoords113c,
};
