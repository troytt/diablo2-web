import type { Memory113c } from '../mem/sparse-memory.ts';
import {
  UNITS_GetAnimStartFrame113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetRoom113c,
  UNITS_AreUnitsAligned113c,
  UNITS_IsShapeshifted113c,
  UNITS_CanUnitMeleeAttackTarget113c,
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
  STATLIST_SetWeaponStatListActive113c,
  STATLIST_SetStat113c,
  STATES_CheckState113c,
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
  PLAYER_StartModeCast113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_CalcMonsterExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_GetPlayerClientClassId113c,
  stepSeedInMem113c,
} from './combat-a1c-113c.ts';
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
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  SKILLS_GetRecordPtrFast113c,
} from './regpop-spawn-113c.ts';

// ---------------------------------------------------------------------------
// Internal D2Game helper procedures (non-exported, used by F786..F1040 VAs)
// ---------------------------------------------------------------------------

/**
 * Enqueues a raw S2C packet payload into a D2ClientStrc's outgoing packet ring
 * buffer (+0x1B8 = writeOffset, +0x1BC = packetCount, +0x1C0 = payloadBuffer).
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
  const writeOff = m.u32(pClient + 0x1b8);
  const pktCount = m.u32(pClient + 0x1bc);
  const bufBase = (pClient + 0x1c0 + writeOff) >>> 0;
  for (let i = 0; i < nLen; i = (i + 1) | 0) {
    m.setU8(bufBase + i, bytes[i] & 0xff);
  }
  m.setU32(pClient + 0x1b8, (writeOff + nLen) >>> 0);
  m.setU32(pClient + 0x1bc, (pktCount + 1) >>> 0);
  return 1;
}

/**
 * Resolves a monster unit's AI owner ID and owner unit type from
 * pMonsterData (+0x14) -> pAiGeneral (+0x28).
 */
function getMonsterAiOwnerIdAndType113c(
  m: Memory113c,
  pMonster: number,
): { ownerId: number; ownerType: number } {
  if (pMonster === 0 || m.u32(pMonster) !== 1) {
    return { ownerId: -1, ownerType: 0 };
  }
  const pMonsterData = m.u32(pMonster + 0x14);
  if (pMonsterData === 0) {
    return { ownerId: -1, ownerType: 0 };
  }
  const pAiGen = m.u32(pMonsterData + 0x28);
  if (pAiGen === 0 || m.u32(pAiGen + 0x28) === 0) {
    return { ownerId: -1, ownerType: 0 };
  }
  return {
    ownerId: (m.u32(pAiGen + 0x2c) | 0),
    ownerType: (m.u32(pAiGen + 0x30) | 0),
  };
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
 * Resolves the party ID (`wPartyId` at `+0x28` of `pPlayerData->pNetClient` or
 * player party list) for a player unit; returns -1 (0xFFFF) if unpartied.
 */
function getPlayerPartyId113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  if (pPlayer === 0 || m.u32(pPlayer) !== 0 || pGame === 0) {
    return -1;
  }
  const pPartyCtrl = m.u32(pGame + 0x1d24);
  if (pPartyCtrl === 0) {
    return -1;
  }
  const unitId = m.u32(pPlayer + 0x0c);
  let pSubParty = m.u32(pPartyCtrl + 0x04);
  while (pSubParty !== 0) {
    const wPartyId = (m.u16(pSubParty) << 16) >> 16;
    let pMember = m.u32(pSubParty + 0x04);
    while (pMember !== 0) {
      if (m.u32(pMember) === unitId) {
        return wPartyId;
      }
      pMember = m.u32(pMember + 0x04);
    }
    pSubParty = m.u32(pSubParty + 0x08);
  }
  return -1;
}

/**
 * Resolves a monster's owning player (if the monster is a pet/summon/missile
 * owned by a player), or returns pAttacker directly if already a player.
 */
function resolveAttackerPlayerOwner113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  if (pUnit === 0) {
    return 0;
  }
  const unitType = m.u32(pUnit);
  if (unitType === 0) {
    return pUnit;
  }
  if (unitType === 1) {
    const owner = getMonsterAiOwnerIdAndType113c(m, pUnit);
    if (owner.ownerId !== -1) {
      const pOwner = SUNIT_GetServerUnit113c(m, pGame, owner.ownerType, owner.ownerId);
      if (pOwner !== 0 && m.u32(pOwner) === 0) {
        return pOwner;
      }
    }
  }
  return 0;
}

/**
 * SuperUnique ID -> quest index lookup table at D2Game.dll 0x6FC56028 (35 bytes).
 */
const SUPERUNIQUE_QUEST_INDEX_TABLE_113C = new Uint8Array([
  0x02, 0x03, 0x04, 0x05, 0x06, 0x1f, 0x0a, 0x0a,
  0x0a, 0x0d, 0x22, 0x22, 0x22, 0x12, 0x14, 0x12,
  0x12, 0x12, 0x21, 0x16, 0x23, 0x0b, 0x28, 0x19,
  0x24, 0x00, 0x25, 0x1e, 0x15, 0x1b, 0x1c, 0x1d,
  0x1d, 0x1d, 0x00,
]);

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
): void {
  if (pClient === 0) {
    return;
  }
  const pGame = m.u32(pClient + 0x1a8);
  if (pGame === 0) {
    return;
  }
  let pUnit = m.u32(pGame + 0x1320 + ((dwUnitId & 0x7f) << 2));
  while (pUnit !== 0 && m.u32(pUnit + 0x0c) !== (dwUnitId >>> 0)) {
    pUnit = m.u32(pUnit + 0xdf);
  }
  let wCurX = 0;
  let wCurY = 0;
  let bPathType = 0;
  let wVelocityPct = 0;
  let bMaxDist = 0;
  if (pUnit !== 0) {
    const unitType = m.u32(pUnit);
    if (unitType <= 1 || unitType === 3) {
      const pPath = m.u32(pUnit + 0x2c);
      if (pPath !== 0) {
        wCurX = PATH_GetPosX113c(m, pPath) & 0xffff;
        wCurY = PATH_GetPosY113c(m, pPath) & 0xffff;
      }
    } else {
      const pPath = m.u32(pUnit + 0x2c);
      if (pPath !== 0) {
        wCurX = m.u16(pPath + 0x04);
        wCurY = m.u16(pPath + 0x06);
      }
    }
    const pPath = m.u32(pUnit + 0x2c);
    const rawPathType = PATH_GetType113c(m, pPath);
    if (rawPathType === 5 || rawPathType === 6) {
      bPathType = 2;
    } else if (rawPathType === 8) {
      bPathType = 11;
    } else {
      bPathType = rawPathType & 0xff;
    }
    let velStat = STATLIST_GetUnitStat113c(m, pUnit, 0x43, 0) | 0;
    if (velStat >= 0x7fff) {
      velStat = 0x7fff;
    } else if (velStat <= -32768) {
      velStat = -32768;
    }
    wVelocityPct = velStat & 0xffff;
    bMaxDist = PATH_GetMaxDistance113c(m, pPath) & 0xff;
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
  pkt[0x10] = 0;
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
  if (pUnit === 0 || m.u32(pUnit) !== 0) {
    return 1;
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pSkill === 0) {
    return 0;
  }
  const ownerItemGuid = SKILLS_GetOwnerItemGuid113c(m, pSkill);
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

// @va D2Game:0x6FCBF850
export function SKILLS_ConsumeSkillManaOrCharge113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  pGame: number,
  nSkillLevel: number,
): number {
  void pGame;
  if (pUnit === 0 || m.u32(pUnit) !== 0) {
    return 1;
  }
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pUsedSkill !== 0) {
    const usedSkillId = SKILLS_GetSkillIdFromSkill113c(m, pUsedSkill, 0, 0);
    if (usedSkillId === nSkillId && SKILLS_GetOwnerItemGuid113c(m, pUsedSkill) !== -1) {
      const charges = (m.u32(pUsedSkill + 0x38) | 0);
      if (charges <= 0) {
        return 0;
      }
      m.setU32(pUsedSkill + 0x38, ((charges - 1) | 0) >>> 0);
      return 1;
    }
  }
  if (nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  const wMana = (m.u16(pSkillsTxt + 0x18a) << 16) >> 16;
  const wLvlMana = (m.u16(pSkillsTxt + 0x18c) << 16) >> 16;
  if (wMana === 0 && wLvlMana === 0) {
    return 0;
  }
  const effLvl = nSkillLevel <= 1 ? 0 : (nSkillLevel - 1) | 0;
  const bManaShift = m.u8(pSkillsTxt + 0x188) & 0x1f;
  let manaCost = (wMana + Math.imul(effLvl, wLvlMana)) << bManaShift;
  const minMana = ((m.u16(pSkillsTxt + 0x18e) << 16) >> 16) << 8;
  if (manaCost < minMana) {
    manaCost = minMana;
  }
  if (STATES_CheckState113c(m, pUnit, 0x72) !== 0) {
    const curHp = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0;
    let hpDrain = manaCost;
    if (curHp - manaCost < 0x100) {
      hpDrain = (curHp - 0x100) | 0;
    }
    if (hpDrain > 0) {
      STATLIST_AddUnitStatMemPort113c(m, pUnit, 6, (-hpDrain) | 0, 0);
    }
    return 1;
  }
  const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0;
  if (curMana < manaCost) {
    return 0;
  }
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 8, (-manaCost) | 0, 0);
  if (pUnit !== 0 && m.u32(pUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit);
    if (pPlayerData !== 0) {
      const pClient = m.u32(pPlayerData + 0x9c);
      if (pClient !== 0) {
        m.setU32(pClient + 0x1a0, (m.u32(pClient + 0x1a0) | 2) >>> 0);
      }
    }
  }
  return 1;
}

// @va D2Game:0x6FCBFC00
export function SKILLS_ValidateSkillTargetAlignment113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
): number {
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
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
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
  }
  if (m.u32(pTarget) === 1) {
    const monMode = m.u32(pTarget + 0x10);
    const isDeadMon = monMode === 0 || monMode === 12;
    const isCorpseSkill = (m.u8(pSkillsTxt + 0x07) & 0x01) !== 0;
    if ((isCorpseSkill && !isDeadMon) || (!isCorpseSkill && isDeadMon)) {
      UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, 0);
    }
  }
  return 1;
}

// @va D2Game:0x6FCBFD00
export function SKILLS_ExecuteSkillStart113c(
  m: Memory113c,
  nSkillId: number,
  pGame: number,
  pUnit: number,
  nSkillLevel: number,
  bNoManaCost: number,
): number {
  if (pGame === 0 || pUnit === 0) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0 || nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  if (bNoManaCost === 0 && SKILLS_CheckSkillManaAndCharges113c(m, pUnit) === 0) {
    return 0;
  }
  if ((m.u8(pSkillsTxt + 0x06) & 0x20) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
      return 0;
    }
  }
  const bLineOfSight = m.u8(pSkillsTxt + 0x183);
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
        losMask = 0x0c01;
      } else if (bLineOfSight === 2) {
        losMask = 0x0405;
      } else if (bLineOfSight === 3) {
        losMask = 0x0104;
      } else if (bLineOfSight === 4) {
        losMask = 0x0800;
      } else if (bLineOfSight === 5) {
        losMask = 0x0c05;
      }
      if (
        losMask !== 0 &&
        SKILLS_TestLineOfSightFromUnitToTarget113c(m, targetX, targetY, pUnit, losMask) === 0
      ) {
        return 0;
      }
    }
  }
  const wSrvStFunc = (m.u16(pSkillsTxt + 0x08) << 16) >> 16;
  let stResult = 1;
  if (wSrvStFunc > 0 && wSrvStFunc < 0x74) {
    if (wSrvStFunc === 1) {
      stResult = SKILLS_StartPlayerSkillAnimOrCast113c(m, pGame, pUnit, nSkillId, nSkillLevel);
    }
  }
  if (stResult === 0) {
    return 0;
  }
  if (stResult !== 2 && (m.u8(pSkillsTxt + 0x04) & 0x08) !== 0 && bNoManaCost === 0) {
    if (SKILLS_ConsumeSkillManaOrCharge113c(m, pUnit, nSkillId, pGame, nSkillLevel) === 0) {
      return 0;
    }
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
): number {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pSkill === 0) {
    return 0;
  }
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0);
  if (nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  if (SKILLS_ValidateSkillTargetAlignment113c(m, pUnit, pGame, nSkillId) === 0) {
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
    const pTarget = PATH_GetTargetUnit113c(m, pPath);
    if (pTarget !== 0) {
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
      const pTargetRoom = UNITS_GetRoom113c(m, pTarget);
      if (pTargetRoom === 0) {
        return 0;
      }
      if ((m.u8(pSkillsTxt + 0x06) & 0x20) === 0) {
        if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) {
          return 0;
        }
      }
    }
  }
  return SKILLS_ExecuteSkillStart113c(m, nSkillId, pGame, pUnit, nSkillLevel, bNoManaCost);
}

// @va D2Game:0x6FCC1630
export function SKILLS_StartPlayerSkillAnimOrCast113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  void nSkillId;
  void nSkillLevel;
  const startFrame = UNITS_GetAnimStartFrame113c(m, pUnit);
  if (pUnit !== 0) {
    m.setU32(pUnit + 0x44, (startFrame << 8) >>> 0);
  }
  if (STATES_CheckStateMaskByIndexOnUnit113c(m, pUnit, 0x26) !== 0) {
    return 1;
  }
  const weaponClass = pUnit !== 0 ? COMPOSIT_IsUnitUsingBowOrCrossbow113c(m, pUnit) : 0;
  if (weaponClass === 0) {
    return 1;
  }
  const pInv = m.u32(pUnit + 0x60);
  let hasAmmo = 0;
  if (pInv !== 0) {
    let pItem = INVENTORY_GetFirstItem113c(m, pInv);
    while (pItem !== 0) {
      if (INVENTORY_UnitIsItem113c(m, pItem) !== 0) {
        const pItemData = m.u32(pItem + 0x14);
        if (pItemData !== 0) {
          const bodyLoc = m.u8(pItemData + 0x45);
          if (bodyLoc === 4 || bodyLoc === 5) {
            const qty = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0);
            if (qty > 0) {
              hasAmmo = 1;
              break;
            }
          }
        }
      }
      pItem = INVENTORY_GetNextItem113c(m, pItem);
    }
  }
  if (hasAmmo !== 0) {
    return 1;
  }
  if (pUnit !== 0 && m.u32(pUnit) === 0) {
    const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
    if (pSkill !== 0) {
      SKILLS_SetFlags113c_inline(m, pSkill, 0x101);
    }
    PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pUnit, 0, 1);
    PLAYER_StartModeCast113c(m, pGame, pUnit);
  }
  return 0;
}

function SKILLS_SetFlags113c_inline(m: Memory113c, pSkill: number, flags: number): void {
  if (pSkill !== 0) {
    m.setU32(pSkill + 0x04, flags >>> 0);
  }
}

// @va D2Game:0x6FCEE310
export function C2S_BroadcastPlayerSkillOrAttackAction113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pClient: number,
  bFlag: number,
): void {
  if (pPlayer === 0 || pClient === 0) {
    return;
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pPlayer);
  if (pSkill === 0) {
    return;
  }
  const skillFlags = SKILLS_GetFlags113c(m, pSkill);
  if ((skillFlags & 0x04) === 0) {
    if (pPlayer === m.u32(pClient + 0x174)) {
      return;
    }
  }
  SUNIT_ValidatePathTargetUnit113c(m, pPlayer, pGame);
  const pPath = m.u32(pPlayer + 0x2c);
  if (pPath === 0) {
    return;
  }
  const pTarget = PATH_GetTargetUnit113c(m, pPath);
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) & 0xffff;
  const nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pPlayer, pSkill, 1) & 0xff;
  const bUnitType = m.u32(pPlayer) & 0xff;
  const dwUnitId = m.u32(pPlayer + 0x0c);
  const ownerItemGuid = SKILLS_GetOwnerItemGuid113c(m, pSkill) >>> 0;
  if (pTarget !== 0 && UNITROOM_IsClientInUnitRoom113c(m, pTarget, pClient) !== 0) {
    const pkt = new Uint8Array(0x10);
    pkt[0x00] = 0x4c;
    pkt[0x01] = bUnitType;
    pkt[0x02] = dwUnitId & 0xff;
    pkt[0x03] = (dwUnitId >>> 8) & 0xff;
    pkt[0x04] = (dwUnitId >>> 16) & 0xff;
    pkt[0x05] = (dwUnitId >>> 24) & 0xff;
    pkt[0x06] = nSkillId & 0xff;
    pkt[0x07] = (nSkillId >>> 8) & 0xff;
    pkt[0x08] = nSkillLvl;
    pkt[0x09] = m.u32(pTarget) & 0xff;
    const targetId = m.u32(pTarget + 0x0c);
    pkt[0x0a] = targetId & 0xff;
    pkt[0x0b] = (targetId >>> 8) & 0xff;
    pkt[0x0c] = (targetId >>> 16) & 0xff;
    pkt[0x0d] = (targetId >>> 24) & 0xff;
    const wExtra = bFlag !== 0 ? 1 : 0;
    pkt[0x0e] = wExtra & 0xff;
    pkt[0x0f] = (wExtra >>> 8) & 0xff;
    enqueueClientPacketBytes113c(m, pClient, pkt, 0x10);
    return;
  }
  let targetX = 0;
  let targetY = 0;
  if (pTarget !== 0) {
    targetX = UNIT_GetPosX113c(m, pTarget) & 0xffff;
    targetY = UNIT_GetPosY113c(m, pTarget) & 0xffff;
  } else {
    targetX = PATH_GetFirstPointX113c(m, pPath) & 0xffff;
    targetY = PATH_GetFirstPointY113c(m, pPath) & 0xffff;
  }
  if (targetX === 0 && targetY === 0) {
    return;
  }
  const pkt = new Uint8Array(0x11);
  pkt[0x00] = 0x4d;
  pkt[0x01] = bUnitType;
  pkt[0x02] = dwUnitId & 0xff;
  pkt[0x03] = (dwUnitId >>> 8) & 0xff;
  pkt[0x04] = (dwUnitId >>> 16) & 0xff;
  pkt[0x05] = (dwUnitId >>> 24) & 0xff;
  pkt[0x06] = nSkillId & 0xff;
  pkt[0x07] = (nSkillId >>> 8) & 0xff;
  pkt[0x08] = (ownerItemGuid >>> 8) & 0xff;
  pkt[0x09] = (ownerItemGuid >>> 16) & 0xff;
  pkt[0x0a] = nSkillLvl;
  pkt[0x0b] = targetX & 0xff;
  pkt[0x0c] = (targetX >>> 8) & 0xff;
  pkt[0x0d] = targetY & 0xff;
  pkt[0x0e] = (targetY >>> 8) & 0xff;
  const wExtra = bFlag !== 0 ? 1 : 0;
  pkt[0x0f] = wExtra & 0xff;
  pkt[0x10] = (wExtra >>> 8) & 0xff;
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
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
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
  const party1 = SUNITDMG_GetPlayerClientClassId113c(m, pPlayer);
  if (party1 === -1) {
    return 0;
  }
  const party2 = SUNITDMG_GetPlayerClientClassId113c(m, pTargetOwner);
  return party1 === party2 ? 1 : 0;
}

// @va D2Game:0x6FD00A60
export function SUNIT_AreUnitsHostileOrUnaligned113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
  pGame: number,
): number {
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
  if (pGame === 0 || pVictim === 0) {
    return;
  }
  if (m.u32(pVictim + 0x74) === 0) {
    return;
  }
  const pQuestCtrl = m.u32(pGame + 0x10f4);
  if (pQuestCtrl === 0 || m.u32(pQuestCtrl + 0x08) !== 0) {
    return;
  }
  const pKillerPlayer = resolveAttackerPlayerOwner113c(m, pGame, pKiller);
  const superUniqueId = MONSTER_GetSuperUniqueId113c(m, pVictim);
  if (superUniqueId >= 0 && superUniqueId < 35) {
    const qIdx = SUPERUNIQUE_QUEST_INDEX_TABLE_113C[superUniqueId];
    const pGameSeed = pQuestCtrl + 0x18;
    stepSeedInMem113c(m, pGameSeed);
    if (qIdx !== 0) {
      m.setU32(pQuestCtrl + 0x14, qIdx >>> 0);
    }
  }
  const victimClassId = m.u32(pVictim + 0x04);
  if (
    victimClassId === 242 ||
    victimClassId === 243 ||
    victimClassId === 391 ||
    victimClassId === 544
  ) {
    m.setU32(pQuestCtrl + 0x10, victimClassId >>> 0);
  }
  let pQuestNode = m.u32(pVictim + 0x74);
  while (pQuestNode !== 0) {
    const questId = m.u32(pQuestNode);
    if (pKillerPlayer !== 0) {
      m.setU32(pQuestCtrl + 0x0c, questId >>> 0);
    }
    pQuestNode = m.u32(pQuestNode + 0x04);
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
  void pGame;
  void pTarget;
  void pArg;
  if (pUnit === 0) {
    return 0;
  }
  const pEventList = m.u32(pUnit + 0x90);
  if (pEventList === 0) {
    return 0;
  }
  let pPrevLink = pEventList;
  let pNode = m.u32(pEventList);
  let dispatched = 0;
  while (pNode !== 0) {
    const wEvent = m.u16(pNode);
    const wFlags = m.u16(pNode + 0x02);
    if ((wFlags & 0x01) === 0 && (wFlags & 0x02) === 0 && wEvent === (nEventType & 0xffff)) {
      m.setU16(pNode + 0x02, (wFlags | 0x01) & 0xffff);
      if (m.u32(pNode + 0x0c) !== 0) {
        dispatched = 1;
      }
      const postFlags = m.u16(pNode + 0x02) & ~0x01;
      m.setU16(pNode + 0x02, postFlags & 0xffff);
      if ((postFlags & 0x02) !== 0 || m.u32(pNode + 0x04) === 0) {
        const pNext = m.u32(pNode + 0x10);
        m.setU32(pPrevLink, pNext >>> 0);
        pNode = pNext;
        continue;
      }
    }
    pPrevLink = (pNode + 0x10) >>> 0;
    pNode = m.u32(pNode + 0x10);
  }
  return dispatched;
}

// @va D2Game:0x6FC57260
export function PLAYER_SetActiveDualWeaponStatLists113c(
  m: Memory113c,
  bEnable: number,
  pPlayer: number,
): void {
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
  bUnitType: number,
  wCoordX: number,
  wCoordY: number,
  bFlag1: number,
  bFlag2: number,
): void {
  if (pClient === 0) {
    return;
  }
  const pkt = new Uint8Array(0x0c);
  pkt[0x00] = bOpcode & 0xff;
  pkt[0x01] = bUnitType & 0xff;
  pkt[0x02] = dwUnitId & 0xff;
  pkt[0x03] = (dwUnitId >>> 8) & 0xff;
  pkt[0x04] = (dwUnitId >>> 16) & 0xff;
  pkt[0x05] = (dwUnitId >>> 24) & 0xff;
  pkt[0x06] = bFlag1 & 0xff;
  pkt[0x07] = bFlag2 & 0xff;
  pkt[0x08] = wCoordX & 0xff;
  pkt[0x09] = (wCoordX >>> 8) & 0xff;
  pkt[0x0a] = wCoordY & 0xff;
  pkt[0x0b] = (wCoordY >>> 8) & 0xff;
  enqueueClientPacketBytes113c(m, pClient, pkt, 0x0c);
}

// @va D2Game:0x6FCB1B70
export function SKILLS_ConsumeProgressiveChargesOnHit113c(
  m: Memory113c,
  pSkillsTxt: number,
  pUnit: number,
  pGame: number,
): void {
  if (pUnit === 0 || pGame === 0) {
    return;
  }
  if (pSkillsTxt !== 0 && m.u8(pSkillsTxt + 0x32) !== 0) {
    return;
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32(pUnit + 0x2c);
  if (pPath === 0) {
    return;
  }
  const pTarget = PATH_GetTargetUnit113c(m, pPath);
  if (pTarget === 0) {
    return;
  }
  if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pUnit, pTarget, pGame) === 0) {
    return;
  }
  const pDmg = SUNITDMG_FindCombatDamageData113c(m, pUnit, pTarget);
  if (pDmg === 0 || (m.u32(pDmg + 0x04) & 0x01) === 0) {
    return;
  }
  if (STATES_CheckStateMaskByIndexOnUnit113c(m, pUnit, 0x19) === 0) {
    return;
  }
  const pDataTables = m.u32(0x6fd1829c);
  if (pDataTables === 0) {
    return;
  }
  const nProgCount = (m.u32(pDataTables + 0x170) | 0);
  const pProgStates = m.u32(pDataTables + 0x16c);
  if (nProgCount <= 0 || pProgStates === 0) {
    return;
  }
  let removedAny = 0;
  for (let i = 0; i < nProgCount; i = (i + 1) | 0) {
    const stateId = (m.u16(pProgStates + ((i * 2) | 0)) << 16) >> 16;
    if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId);
      if (pStatList !== 0) {
        const skillId = STATLIST_GetStatValue113c(m, pStatList, 0x144, 0);
        const charges = STATLIST_GetStatValue113c(m, pStatList, 0x156, skillId);
        if (charges > 0 && skillId >= 0) {
          STATLIST_UnlinkSubList113c(m, pUnit, pStatList);
          STATLIST_FreeStatListIfNonExtended113c(m, pStatList);
          removedAny = 1;
        }
      }
    }
  }
  if (removedAny !== 0) {
    UNITS_TransferStateMaskDCToRemoved113c(m, pUnit);
  }
}

// @va D2Game:0x6FCB1E30
export function SKILLS_ApplyProgressiveChargesToDamage113c(
  m: Memory113c,
  pUnit: number,
  pDmg: number,
): void {
  if (pUnit === 0 || pDmg === 0) {
    return;
  }
  if (STATES_CheckStateMaskByIndexOnUnit113c(m, pUnit, 0x19) === 0) {
    return;
  }
  const pDataTables = m.u32(0x6fd1829c);
  if (pDataTables === 0) {
    return;
  }
  const nProgCount = (m.u32(pDataTables + 0x170) | 0);
  const pProgStates = m.u32(pDataTables + 0x16c);
  if (nProgCount <= 0 || pProgStates === 0) {
    return;
  }
  for (let i = 0; i < nProgCount; i = (i + 1) | 0) {
    const stateId = (m.u16(pProgStates + ((i * 2) | 0)) << 16) >> 16;
    if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId);
      if (pStatList !== 0) {
        const skillId = STATLIST_GetStatValue113c(m, pStatList, 0x144, 0);
        const charges = STATLIST_GetStatValue113c(m, pStatList, 0x156, skillId);
        const slvl = STATLIST_GetStatValue113c(m, pStatList, 0x155, skillId);
        if (charges > 0 && slvl > 0 && skillId >= 0) {
          const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId);
          if (pSkillsTxt !== 0) {
            const bPrgDam = m.u8(pSkillsTxt + 0x33);
            if (bPrgDam >= 2 && bPrgDam <= 4) {
              const calcOff = (0x168 + ((charges - 1) << 2)) | 0;
              const bonusVal = SKILLS_EvalCalcByOffset113c(m, pUnit, calcOff, skillId, slvl);
              if (bPrgDam === 2) {
                m.setU32(pDmg + 0x60, (((m.u32(pDmg + 0x60) | 0) + bonusVal) | 0) >>> 0);
              } else if (bPrgDam === 3) {
                m.setU32(pDmg + 0x0c, (((m.u32(pDmg + 0x0c) | 0) + bonusVal) | 0) >>> 0);
              } else if (bPrgDam === 4) {
                const stealBonus = STATLIST_GetStatValue113c(m, pStatList, 0x3c, 0);
                m.setU32(pDmg + 0x3c, (((m.u32(pDmg + 0x3c) | 0) + stealBonus) | 0) >>> 0);
                const manaBonus = STATLIST_GetStatValue113c(m, pStatList, 0x3e, 0);
                m.setU32(pDmg + 0x40, (((m.u32(pDmg + 0x40) | 0) + manaBonus) | 0) >>> 0);
              }
            }
          }
        }
      }
    }
  }
}

// @va D2Game:0x6FCB22A0
export function SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(
  m: Memory113c,
  pUnit: number,
  pDmg: number,
): void {
  if (pUnit === 0 || pDmg === 0) {
    return;
  }
  if (STATES_CheckStateMaskByIndexOnUnit113c(m, pUnit, 0x19) === 0) {
    return;
  }
  const pDataTables = m.u32(0x6fd1829c);
  if (pDataTables === 0) {
    return;
  }
  const nProgCount = (m.u32(pDataTables + 0x170) | 0);
  const pProgStates = m.u32(pDataTables + 0x16c);
  if (nProgCount <= 0 || pProgStates === 0) {
    return;
  }
  for (let i = 0; i < nProgCount; i = (i + 1) | 0) {
    const stateId = (m.u16(pProgStates + ((i * 2) | 0)) << 16) >> 16;
    if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId);
      if (pStatList !== 0) {
        const skillId = STATLIST_GetStatValue113c(m, pStatList, 0x144, 0);
        const charges = STATLIST_GetStatValue113c(m, pStatList, 0x156, skillId);
        const slvl = STATLIST_GetStatValue113c(m, pStatList, 0x155, skillId);
        if (charges > 0 && slvl > 0 && skillId >= 0) {
          const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId);
          if (pSkillsTxt !== 0 && m.u8(pSkillsTxt + 0x33) === 1) {
            const calcOff = (0x168 + ((charges - 1) << 2)) | 0;
            const bonusPct = SKILLS_EvalCalcByOffset113c(m, pUnit, calcOff, skillId, slvl);
            m.setU32(pDmg + 0x60, (((m.u32(pDmg + 0x60) | 0) + bonusPct) | 0) >>> 0);
          }
        }
      }
    }
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
  if (pAttacker === 0 || pDefender === 0 || pDmg === 0) {
    return;
  }
  const attackerType = m.u32(pAttacker);
  if (attackerType !== 0 && attackerType !== 1) {
    return;
  }
  if (SUNIT_IsDeadOrDying113c(m, pAttacker) !== 0) {
    return;
  }
  let thornsPct = STATLIST_GetUnitStat113c(m, pDefender, 0x83, 0) | 0;
  if (thornsPct <= 0) {
    return;
  }
  if (attackerType === 0 || MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0) {
    thornsPct = Math.trunc((thornsPct + 4) / 8) | 0;
  }
  const physDmg = (m.u32(pDmg + 0x08) | 0);
  const reflectedPhys = Math.trunc(Math.imul(physDmg, thornsPct) / 100) | 0;
  if (reflectedPhys < 0x100) {
    return;
  }
  const scratchDmg = 0x004ff100;
  for (let i = 0; i < 0x70; i = (i + 4) | 0) {
    m.setU32(scratchDmg + i, 0);
  }
  m.setU32(scratchDmg + 0x00, 0x21);
  m.setU16(scratchDmg + 0x04, 0x80);
  m.setU32(scratchDmg + 0x08, reflectedPhys >>> 0);
  m.setU32(scratchDmg + 0x48, reflectedPhys >>> 0);
  SUNITDMG_ApplyDamage113c(m, pGame, pDefender, pAttacker, scratchDmg);
  SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pDefender, pAttacker, scratchDmg);
}

// @va D2Game:0x6FCBC000
export function PARTY_CountLivingPartyMemberCallback113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pCountOut: number,
): void {
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
  if (pPlayer === 0 || m.u32(pPlayer) !== 0) {
    return;
  }
  const wPartyId = getPlayerPartyId113c(m, pPlayer, pGame);
  if (wPartyId === -1) {
    pfnCallback(m, pGame, pPlayer, pArg);
    return;
  }
  const pPlayerRoom = UNITS_GetRoom113c(m, pPlayer);
  if (pPlayerRoom === 0) {
    pfnCallback(m, pGame, pPlayer, pArg);
    return;
  }
  const playerLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pPlayerRoom);
  if (playerLevelId === 0 || pGame === 0) {
    return;
  }
  const pPartyCtrl = m.u32(pGame + 0x1d24);
  if (pPartyCtrl === 0) {
    return;
  }
  let pSubParty = m.u32(pPartyCtrl + 0x04);
  while (pSubParty !== 0) {
    if (((m.u16(pSubParty) << 16) >> 16) === wPartyId) {
      let pMember = m.u32(pSubParty + 0x04);
      while (pMember !== 0) {
        const memberUnitId = m.u32(pMember);
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
        pMember = m.u32(pMember + 0x04);
      }
      return;
    }
    pSubParty = m.u32(pSubParty + 0x08);
  }
}

// @va D2Game:0x6FCBC1F0
export function PARTY_CountLivingPartyMembersInSameLevel113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
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
  if (pGame === 0 || pUnit === 0 || nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  const delayFlags = m.u8(pSkillsTxt + 0x04) & 0x60;
  if (bResetExisting !== 0) {
    if (delayFlags === 0) {
      return 0;
    }
  } else if ((m.u8(pSkillsTxt + 0x04) & 0x20) === 0) {
    return 0;
  }
  const delayFrames = SKILLS_EvalCalcByOffset113c(m, pUnit, 0x160, nSkillId, nSkillLevel);
  if (delayFrames < 5) {
    return 0;
  }
  const expireFrame = ((m.u32(pGame + 0xa8) | 0) + delayFrames) | 0;
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0x79);
  if (pStatList !== 0) {
    STATLIST_SetStat113c(m, pStatList, 0, expireFrame, 0);
  }
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 8, 0);
  EVENT_SetEventFull113c(m, pGame, pUnit, 8, expireFrame, 0, 0, 0);
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
): number {
  if (pGame === 0 || pUnit === 0) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0 || nSkillId < 0) {
    return 0;
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId);
  if (pSkillsTxt === 0) {
    return 0;
  }
  if ((m.u8(pSkillsTxt + 0x06) & 0x20) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
      return 0;
    }
  }
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  let effLevel = nSkillLevel;
  let bNoMana = bConsumeMana === 0 ? 1 : 0;
  if (bCheckItem !== 0 && pUsedSkill !== 0) {
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
    (m.u8(pSkillsTxt + 0x04) & 0x08) === 0 &&
    SKILLS_CheckSkillManaAndCharges113c(m, pUnit) === 0
  ) {
    return 0;
  }
  const wDoFuncIdx =
    bUseAltFunc !== 0
      ? (m.u16(pSkillsTxt + 0x0c) << 16) >> 16
      : (m.u16(pSkillsTxt + 0x0a) << 16) >> 16;
  let doResult = 1;
  if (wDoFuncIdx > 0 && wDoFuncIdx < 0x9b) {
    if (wDoFuncIdx === 1) {
      doResult = SrvDoFunc_001_Attack113c(m, pGame, pUnit, nSkillId, effLevel);
    }
  }
  if (doResult === 0) {
    return 0;
  }
  if (bNoMana === 0 && (m.u8(pSkillsTxt + 0x04) & 0x08) === 0) {
    SKILLS_ConsumeSkillManaOrCharge113c(m, pUnit, nSkillId, pGame, effLevel);
  }
  if ((m.u8(pSkillsTxt + 0x05) & 0x02) !== 0) {
    const perDelay = SKILLS_EvalCalcByOffset113c(m, pUnit, 0x164, nSkillId, effLevel);
    if (perDelay > 0) {
      const nextFrame = ((m.u32(pGame + 0xa8) | 0) + perDelay) | 0;
      EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, nextFrame, 0, nSkillId, effLevel);
    }
  }
  return doResult;
}

// @va D2Game:0x6FCC2060
export function SKILLS_DoUsedSkillAction113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): number {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit);
  if (pSkill === 0) {
    return 0;
  }
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0);
  if (nSkillId < 0) {
    return 0;
  }
  const nSkillLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1);
  const res = SKILLS_ExecuteSkillDoFunc113c(m, pUnit, pGame, nSkillId, nSkillLevel, 1, 1, 0);
  SKILLS_SetSkillDelayTimer113c(m, nSkillId, pGame, pUnit, nSkillLevel, 0);
  return res;
}

// @va D2Game:0x6FCC2C40
export function SrvDoFunc_001_Attack113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  void nSkillId;
  void nSkillLevel;
  if (pAttacker === 0) {
    return 0;
  }
  m.setU32(pAttacker + 0xc4, (m.u32(pAttacker + 0xc4) | 0x40) >>> 0);
  let pWeapon = 0;
  if (m.u32(pAttacker) === 0) {
    pWeapon = PLAYER_GetEquippedWeapon113c(m, pAttacker);
    if (pWeapon !== 0) {
      const itemType = ITEMS_GetItemTypeFromItem113c(m, pWeapon);
      if (itemType === 0x1b || itemType === 0x23 || itemType === 0x55) {
        return 0;
      }
    }
  }
  const pPath = m.u32(pAttacker + 0x2c);
  if (pPath === 0) {
    return 0;
  }
  const pDefender = PATH_GetTargetUnit113c(m, pPath);
  if (pDefender === 0) {
    return 0;
  }
  if (SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) {
    return 0;
  }
  if (UNITS_CanUnitMeleeAttackTarget113c(m, pAttacker, pDefender, 1) === 0) {
    return 0;
  }
  const scratchDmg = 0x004ff200;
  for (let i = 0; i < 0x70; i = (i + 4) | 0) {
    m.setU32(scratchDmg + i, 0);
  }
  const scratchBonusPtr = 0x004ff280;
  m.setU32(scratchBonusPtr, 0);
  const masteryStatId = SKILLS_GetWeaponMasteryPassiveStatId113c(m, pAttacker, scratchBonusPtr);
  if (masteryStatId >= 0) {
    const arBonus = STATLIST_GetUnitStat113c(m, pAttacker, masteryStatId, 0);
    m.setU32(scratchDmg + 0x5c, arBonus >>> 0);
    m.setU32(scratchDmg + 0x60, m.u32(scratchBonusPtr));
  }
  if (m.u32(pAttacker) === 0 && m.u32(pAttacker + 0x10) === 0x08) {
    const pSkill50 = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pAttacker, 0x32);
    if (pSkill50 !== 0) {
      const slvl50 = SKILLS_EvaluateSkillLevel113c(m, pAttacker, pSkill50, 1);
      if (slvl50 > 0) {
        const bonus50 = SKILLS_EvalCalcByOffset113c(m, pAttacker, 0x154, 0x32, slvl50);
        m.setU32(scratchDmg + 0x60, (((m.u32(scratchDmg + 0x60) | 0) + bonus50) | 0) >>> 0);
      }
    }
  }
  SUNITDMG_CalcMonsterExperience113c(m, pGame, pDefender);
  SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(m, pAttacker, scratchDmg);
  SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, scratchDmg, 0, 0x80);
  SKILLS_ApplyProgressiveChargesToDamage113c(m, pAttacker, scratchDmg);
  SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, scratchDmg, 0x80);
  SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, pAttacker, pGame);
  SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, scratchDmg);
  return 1;
}

// @va D2Game:0x6FCCF8D0
export function MONSTER_DeleteAiAndRegenEvents113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  if (pUnit === 0) {
    return;
  }
  let pEv = m.u32(pUnit + 0xdc);
  while (pEv !== 0) {
    const pNext = m.u32(pEv + 0x1c);
    if (m.u32(pEv) === 2) {
      EVENT_FreeNode113c(m, pGame, pEv);
    }
    pEv = pNext;
  }
  pEv = m.u32(pUnit + 0xdc);
  while (pEv !== 0) {
    const pNext = m.u32(pEv + 0x1c);
    if (m.u32(pEv) === 3) {
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

// @va D2Game:0x6FCD2940
export function ARENA_ProcessKillScoreUpdate113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pVictim: number,
): void {
  if (pGame === 0) {
    return;
  }
  const pArenaCtrl = m.u32(pGame + 0x1d28);
  if (pArenaCtrl === 0 || pVictim === 0) {
    return;
  }
  const nArenaType = (m.u32(pArenaCtrl + 0x04) | 0);
  const pArenaTxt = DATATBLS_GetArenaTxtRecord113c(m, nArenaType);
  if (pArenaTxt === 0) {
    return;
  }
  m.setU32(pArenaCtrl + 0x08, (m.u32(pArenaCtrl + 0x08) | 0x400) >>> 0);
  const pKillerPlayer = resolveAttackerPlayerOwner113c(m, pGame, pAttacker);
  const victimType = m.u32(pVictim);
  if (pKillerPlayer === 0 || pKillerPlayer === pVictim) {
    if (victimType === 0) {
      const pVictimData = UNITS_GetPlayerData113c(m, pVictim);
      const pVictimArena = pVictimData !== 0 ? m.u32(pVictimData + 0x34) : 0;
      if (pVictimArena !== 0) {
        const suicideDelta = (m.u32(pArenaTxt + 0x00) | 0);
        m.setU32(pVictimArena, (((m.u32(pVictimArena) | 0) + suicideDelta) | 0) >>> 0);
        m.setU32(pVictimArena + 0x08, 1);
      }
      UNITROOM_RefreshUnit113c(m, pVictim);
    }
    return;
  }
  const pKillerData = UNITS_GetPlayerData113c(m, pKillerPlayer);
  const pKillerArena = pKillerData !== 0 ? m.u32(pKillerData + 0x34) : 0;
  if (victimType === 0) {
    const pVictimData = UNITS_GetPlayerData113c(m, pVictim);
    const pVictimArena = pVictimData !== 0 ? m.u32(pVictimData + 0x34) : 0;
    const killerScoreDelta = (m.u32(pArenaTxt + 0x04) | 0);
    const killerPctDelta = (m.u32(pArenaTxt + 0x08) | 0);
    const victimScoreDelta = (m.u32(pArenaTxt + 0x10) | 0);
    const victimPctDelta = (m.u32(pArenaTxt + 0x14) | 0);
    let pctScore = 0;
    if (pVictimArena !== 0) {
      pctScore = Math.trunc(Math.imul((m.u32(pVictimArena) | 0), killerPctDelta) / 100) | 0;
    }
    if (pKillerArena !== 0) {
      m.setU32(pKillerArena, (((m.u32(pKillerArena) | 0) + killerScoreDelta + pctScore) | 0) >>> 0);
      m.setU32(pKillerArena + 0x08, 1);
    }
    if (pVictimArena !== 0) {
      const lostPct = Math.trunc(Math.imul((m.u32(pVictimArena) | 0), victimPctDelta) / 100) | 0;
      m.setU32(pVictimArena, (((m.u32(pVictimArena) | 0) + victimScoreDelta - lostPct) | 0) >>> 0);
      m.setU32(pVictimArena + 0x08, 1);
    }
    UNITROOM_RefreshUnit113c(m, pKillerPlayer);
    UNITROOM_RefreshUnit113c(m, pVictim);
  } else if (victimType === 1 && pKillerArena !== 0) {
    const monKillDelta = (m.u32(pArenaTxt + 0x0c) | 0);
    m.setU32(pKillerArena, (((m.u32(pKillerArena) | 0) + monKillDelta) | 0) >>> 0);
    m.setU32(pKillerArena + 0x08, 1);
    UNITROOM_RefreshUnit113c(m, pKillerPlayer);
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
  bUnitType: number,
  bHitClass: number,
  dwCoordXY: number,
  bLifePct: number,
  wAnimSpeed: number,
  wFlags: number,
): void {
  if (pClient === 0) {
    return;
  }
  const pkt = new Uint8Array(0x10);
  pkt[0x00] = bOpcode & 0xff;
  pkt[0x01] = bUnitType & 0xff;
  pkt[0x02] = dwUnitId & 0xff;
  pkt[0x03] = (dwUnitId >>> 8) & 0xff;
  pkt[0x04] = (dwUnitId >>> 16) & 0xff;
  pkt[0x05] = (dwUnitId >>> 24) & 0xff;
  pkt[0x06] = bHitClass & 0xff;
  pkt[0x07] = dwCoordXY & 0xff;
  pkt[0x08] = (dwCoordXY >>> 8) & 0xff;
  pkt[0x09] = (dwCoordXY >>> 16) & 0xff;
  pkt[0x0a] = (dwCoordXY >>> 24) & 0xff;
  pkt[0x0b] = bLifePct & 0xff;
  pkt[0x0c] = wAnimSpeed & 0xff;
  pkt[0x0d] = (wAnimSpeed >>> 8) & 0xff;
  pkt[0x0e] = wFlags & 0xff;
  pkt[0x0f] = (wFlags >>> 8) & 0xff;
  enqueueClientPacketBytes113c(m, pClient, pkt, 0x10);
}

// ===========================================================================
// F1040 (4 VAs)
// ===========================================================================

// @va D2Game:0x6FCAC890
export function ITEMS_SyncSocketedSubItemsToClient113c(
  m: Memory113c,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): number {
  if (ITEMS_GetSubTypeFromItem113c(m, pItem) === 0) {
    return 1;
  }
  if (ITEMS_TestFlagMask113c(m, nCmdFlags, 0x20) !== 0) {
    return 1;
  }
  if (pItem === 0) {
    return 1;
  }
  const pInv = m.u32(pItem + 0x60);
  if (pInv === 0) {
    return 1;
  }
  let pSubItem = INVENTORY_GetFirstItem113c(m, pInv);
  if (pSubItem === 0) {
    return 1;
  }
  const scratchFlagsPtr = 0x004ff300;
  const scratchPktBuf = 0x004ff310;
  while (pSubItem !== 0) {
    const pVerified = INVENTORY_UnitIsItem113c(m, pSubItem);
    m.setU32(scratchFlagsPtr, nCmdFlags >>> 0);
    ITEMS_SetOrClearFlagMask113c(m, scratchFlagsPtr, 0x08, 1);
    const updatedFlags = m.u32(scratchFlagsPtr);
    const pktLen = buildItemActionPacketBuffer113c(
      m,
      pVerified,
      pItem,
      0x9d,
      0x0b,
      1,
      updatedFlags,
      0,
      scratchPktBuf,
    );
    if (pktLen > 0) {
      const pktBytes = new Uint8Array(pktLen);
      for (let i = 0; i < pktLen; i = (i + 1) | 0) {
        pktBytes[i] = m.u8(scratchPktBuf + i);
      }
      enqueueClientPacketBytes113c(m, pClient, pktBytes, pktLen);
    }
    pSubItem = INVENTORY_GetNextItem113c(m, pSubItem);
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
  void bFlag;
  if (pClient === 0 || pItem === 0) {
    return;
  }
  const pGame = m.u32(pClient + 0x1a8);
  let pClientPlayer = m.u32(pClient + 0x174);
  if (pClientPlayer === 0 && pGame !== 0) {
    const clientUnitType = m.u32(pClient + 0x16c);
    const clientUnitId = m.u32(pClient + 0x170);
    pClientPlayer = SUNIT_GetServerUnit113c(m, pGame, clientUnitType, clientUnitId);
  }
  let effectiveFlags = nCmdFlags;
  if (pClientPlayer !== 0) {
    const equipLoc = INVENTORY_GetItemEquipLocation113c(m, pClientPlayer, pItem);
    if (equipLoc === 2 || equipLoc === 1) {
      effectiveFlags = (effectiveFlags | 0x01) >>> 0;
    } else if (equipLoc !== 3 && equipLoc !== 4) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x01, 0);
    }
  }
  const scratchPktBuf = 0x004ff410;
  const pktLen = buildItemActionPacketBuffer113c(
    m,
    pItem,
    0,
    0x9c,
    bAction,
    1,
    effectiveFlags,
    0,
    scratchPktBuf,
  );
  if (pktLen > 0) {
    const pktBytes = new Uint8Array(pktLen);
    for (let i = 0; i < pktLen; i = (i + 1) | 0) {
      pktBytes[i] = m.u8(scratchPktBuf + i);
    }
    enqueueClientPacketBytes113c(m, pClient, pktBytes, pktLen);
  }
  ITEMS_SyncSocketedSubItemsToClient113c(m, pClient, pItem, effectiveFlags);
}

// @va D2Game:0x6FCF40F0
export function UNITROOM_SendDroppedGroundItemToClient113c(
  m: Memory113c,
  pItem: number,
  pClient: number,
): void {
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
  const bAction = ((dwFlags >>> 12) & 1) !== 0 ? 2 : 3;
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pItem, bAction, 0, 0);
}

// @va D2Game:0x6FCF4550
export function UNITROOM_BroadcastGroundItemIfUpdated113c(
  m: Memory113c,
  pItem: number,
  pClient: number,
): void {
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
