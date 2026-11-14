/**
 * Pure 1:1 `D2Game.dll` v1.13c item-defense, aura, static-field, item-event,
 * scroll/tome charge, equipment stat activation, alignment, and triggered-skill
 * procedures for `[K2]` (`p52-item-defense` dynamic gap closure, 32 VAs).
 *
 * Every exported target VA function is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import {
  COLLISION_GetMaskWithPattern2_113c,
  COLLISION_RayTrace113c,
} from '../common/collision.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { MONSTER_GetMonStatsInteractBit113c } from '../common/drlg/drlg-ver.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.ts'
import { mulDiv113c } from '../common/int-math.ts'
import {
  ITEMS_ApplyItemQualityMods113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetGemApplyTypeFromItem113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetMagicSuffix113c,
} from '../common/items.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.ts'
import {
  PATH_ComputeSquaredDistance113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetFootprintCollisionMask113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetTargetPos113c,
} from '../common/path.ts'
import {
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record.ts'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateManaCost256ths113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetCharges113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetItemSkillInfo113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetPassiveState113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetUnitSkillBonusBySkillId113c,
  SKILLS_IsSelectableCorpse11157_113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_SetCharges113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetRightSkill113c,
} from '../common/skills.ts'
import {
  ITEMMODS_UpdateSetItemEquipmentState113c,
  STATES_ApplyMonSkillIconToUnit113c,
  STATES_CheckState113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_ClampUnitPoolStatsToMax113c,
  STATLIST_ExpireTimedSubLists113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetExpireFrameEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetSkillId113c,
  STATLIST_GetSkillLevel113c,
  STATLIST_GetState113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrame113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetSkillId113c,
  STATLIST_SetSkillLevel113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetUnitStat113c,
  STATLIST_SetWeaponStatListActive113c,
  STATLIST_UnlinkSubList113c,
  STATLIST_UnlinkUnitStatList113c,
} from '../common/statlist.ts'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
  UNITFINDS_MatchUnitCandidate113c,
} from '../common/unit-finds.ts'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_AreUnitsAligned113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_CheckStateMaskAura113c,
  UNITS_CheckStateMaskExp113c,
  UNITS_CheckStateMaskOnCurse113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  DATATBLS_GetGemsTxtRecord113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetQualityItemsTxtRecord113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDemonOrUndead113c,
} from '../tables/datatbls-113c.ts'
import {
  SKILLS_ExecuteSkillDoFunc113c,
  SKILLS_ExecuteSkillStart113c,
  SKILLS_SetSkillDelayTimer113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import {
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
} from './boot-init-gap-b-113c.ts'
import {
  MONSTER_StartDeath113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_DistributeExperience113c,
} from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { CLIENTS_GetPlayerUnit113c } from './replay-final11-113c.ts'
import { UNITS_CanDualWield113c } from './replay-kernel-113c.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  SUNIT_GetLastAttacker113c,
} from './timer-wheel.ts'

// ---------------------------------------------------------------------------
// Binary constant tables & scratch stack region
// ---------------------------------------------------------------------------

/** Reentrant stack frame pointer for temporary stack structs in `Memory113c`. */
let itemdefGapStackPtr = 0x7fe80000

/** `D2Game.dll` `.rdata` `0x6FD1B970`: `int32[4]` random elemental type remap table. */
const RANDOM_ELEM_TYPES_TABLE_113C = [1, 2, 4, 5] as const

/**
 * `D2Game.dll` `.data` `0x6FD277A8`: `uint32[50]` item-event handler VA table
 * indexed by `nItemEventId` (`0..49`).
 */
export const D2GAME_ITEM_EVENT_CALLBACK_TABLE_113C: readonly number[] = [
  0x00000000, 0x6fc634e0, 0x6fc62c70, 0x6fc62b40, 0x6fc6f090,
  0x6fc6e760, 0x6fccd910, 0x6fccce60, 0x6fccf2e0, 0x6fcce0e0,
  0x6fccd860, 0x6fccd7b0, 0x6fccd6c0, 0x6fcccda0, 0x6fccd580,
  0x6fccd410, 0x6fcccc30, 0x6fcccba0, 0x6fccca70, 0x6fccd2a0,
  0x6fccddc0, 0x6fccdce0, 0x6fc6dfe0, 0x6fc6e5f0, 0x6fc61fb0,
  0x6fc64600, 0x6fc6e500, 0x6fc6ef70, 0x6fcccb10, 0x6fccc910,
  0x6fccdbf0, 0x6fccf210, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
]

const SELF_AURA_REMOVE_PROC_VA_113C = 0x6fcb8450
const DEFAULT_AURA_REMOVE_PROC_VA_113C = 0x6fcbf7a0
const STATIC_FIELD_CALLBACK_VA_113C = 0x6fc62ec0
const RADIAL_AURA_BUFF_CALLBACK_VA_113C = 0x6fcba1a0
const CORPSE_FIND_FILTER_VA_113C = 0x6fcbe2e0

export type AuraRadiusUnitCallback113c = (
  m: Memory113c,
  pAuraCtx: number,
  pTargetUnit: number,
) => number

// ---------------------------------------------------------------------------
// Private internal helpers
// ---------------------------------------------------------------------------

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function readSgptDataTables(m: Memory113c): number {
  const pIatTarget = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (pIatTarget === 0) return 0
  return m.u32(pIatTarget) >>> 0
}

function readGdwBitMaskByte(m: Memory113c, byteOffset: number): number {
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  if (pMasks === 0) return 0
  return m.u8((pMasks + byteOffset) >>> 0)
}

function cSignedDiv100(x: number): number {
  return Math.trunc((x | 0) / 100) | 0
}

/**
 * Exact 4-way overflow-safe signed `(a * b) / 100` integer scaling used by D2Game
 * (`imul 0x51eb851f` fast-path + `_alldiv` 64-bit path).
 */
function scaleSignedPercent64(aRaw: number, bRaw: number): number {
  const a = aRaw | 0
  const b = bRaw | 0
  if (a > 0x100000) {
    if (((a & ~0x0f) | 0) < 0x640) {
      return Number((BigInt(b) * BigInt(a)) / 100n) | 0
    }
    return Math.imul(cSignedDiv100(a), b) | 0
  }
  if (b > 0x10000) {
    if (((b & ~0x0f) | 0) >= 0x640) {
      return Math.imul(cSignedDiv100(b), a) | 0
    }
    return Number((BigInt(b) * BigInt(a)) / 100n) | 0
  }
  return cSignedDiv100(Math.imul(b, a))
}

/**
 * Exact post-damage reaction step following `SUNITDMG_ApplyDamage113c` for callers
 * that invoke both `SUNITDMG_ExecuteDamage` and `SUNITDMG_ExecuteMissileDamage`
 * without double-subtracting hitpoints.
 */
function applyPostDamageHitReaction(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  if (pDefender === 0 || pDmg === 0) return
  const resultFlags = m.u16((pDmg + 0x04) >>> 0)
  if ((resultFlags & 0x0001) !== 0) {
    const hitClass = m.u32((pDmg + 0x60) >>> 0)
    m.setU32((pDefender + 0xb0) >>> 0, hitClass)
  }
  if ((resultFlags & 0x0002) !== 0 && (m.u32(pDefender >>> 0) >>> 0) === 1) {
    if (STATES_CheckState113c(m, pDefender, 0x36) !== 0) {
      STATES_ToggleGfxStateFlag113c(m, pDefender, 0x5c, 1)
      return
    }
    SUNITDMG_DistributeExperience113c(m, pGame, pAttacker, pDefender)
    MONSTER_StartDeath113c(m, pGame, pDefender, pAttacker, false)
  }
}

/** Looks up `D2MissilesTxt*` (`sgptDataTables + 0xB64`, stride `0x1A4`, count `+0xB6C`). */
function getMissilesTxtRecordFast(m: Memory113c, nMissileId: number): number {
  const id = nMissileId | 0
  if (id < 0) return 0
  const pTables = readSgptDataTables(m)
  if (pTables === 0) return 0
  const count = m.u32((pTables + 0xb6c) >>> 0) | 0
  if (id >= count) return 0
  const pBase = m.u32((pTables + 0xb64) >>> 0) >>> 0
  if (pBase === 0) return 0
  return (pBase + Math.imul(id, 0x1a4)) >>> 0
}

/** Resolves a missile unit's owner server unit when `(dwFlags2 & 0x400) != 0`. */
function resolveMissileOwnerUnit(m: Memory113c, pMissile: number, pGame: number): number {
  if (pMissile === 0) return 0
  const flags2 = m.u32((pMissile + 0xc8) >>> 0)
  if (((flags2 >>> 10) & 1) === 0) return 0
  const ownerType = m.u32((pMissile + 0x94) >>> 0) | 0
  const ownerId = m.u32((pMissile + 0x98) >>> 0) >>> 0
  return SUNIT_GetServerUnit113c(m, pGame, ownerType, ownerId)
}

/** Reads `MonStatsTxt.nVelocity` minimum floor (`+0x168 + difficulty`, else `-50`). */
function getMonsterVelocityFloor(m: Memory113c, pUnit: number, pGame: number): number {
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1) return -50
  const classId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (classId < 0) return -50
  const pTables = readSgptDataTables(m)
  if (pTables === 0) return -50
  const count = m.u32((pTables + 0xa80) >>> 0) | 0
  if (classId >= count) return -50
  const pBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
  if (pBase === 0) return -50
  const pMonStats = (pBase + Math.imul(classId, 0x1a8)) >>> 0
  if (pMonStats === 0 || pGame === 0) return -50
  const diff = m.u8((pGame + 0x6d) >>> 0)
  return sx8(m.u8((pMonStats + 0x168 + diff) >>> 0))
}

/** Reduces active cold (`2`) and exp-masked curse/debuff durations on `pTarget` by `nPct`%. */
function reduceCurseAndColdDurations(
  m: Memory113c,
  nPct: number,
  pGame: number,
  pTarget: number,
): number {
  if (pGame === 0 || pTarget === 0) return 0
  let updated = 0
  const pct = nPct | 0

  if (STATES_CheckState113c(m, pTarget, 2) !== 0) {
    const pColdList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTarget, 2)
    if (pColdList !== 0) {
      const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
      const oldExpire = STATLIST_GetExpireFrameEx113c(m, pColdList) | 0
      const rem = (oldExpire - curFrame) | 0
      const reduced = mulDiv113c(pct, rem, 100) | 0
      const newExpire = (curFrame + reduced) | 0
      STATLIST_SetExpireFrameEx113c(m, pColdList, newExpire)
      EVENT_SetEventFull113c(m, pGame, pTarget, 0x0c, newExpire, 0, 0, 0)
      updated = 1
    }
  }

  const pTables = readSgptDataTables(m)
  if (pTables === 0) return updated
  const nCurseStates = sx16(m.u16((pTables + 0x178) >>> 0))
  const pCurseStates = m.u32((pTables + 0x174) >>> 0) >>> 0
  if (nCurseStates <= 0 || pCurseStates === 0) return updated

  for (let idx = 0; idx < nCurseStates; idx++) {
    const stateId = sx16(m.u16((pCurseStates + idx * 2) >>> 0))
    if (STATES_CheckState113c(m, pTarget, stateId) === 0) continue
    const pSubList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTarget, stateId)
    if (pSubList === 0) continue
    if (UNITS_CheckStateMaskExp113c(m, stateId) !== 0) {
      const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
      const oldExpire = STATLIST_GetExpireFrameEx113c(m, pSubList) | 0
      const rem = (oldExpire - curFrame) | 0
      const reduced = scaleSignedPercent64(rem, pct)
      const newExpire = (curFrame + reduced) | 0
      STATLIST_SetExpireFrameEx113c(m, pSubList, newExpire)
      EVENT_SetEventFull113c(m, pGame, pTarget, 0x0c, newExpire, 0, 0, 0)
    }
    updated = 1
  }
  return updated
}

/** Deducts Blood Mana HP (`STATE_BLOOD_MANA = 0x72`) or `STAT_MANA (8)` for player aura upkeep. */
function deductPlayerAuraManaOrBloodMana(
  m: Memory113c,
  nManaCost256: number,
  pUnit: number,
): number {
  const cost = nManaCost256 | 0
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 0) return 1

  if (STATES_CheckState113c(m, pUnit, 0x72) !== 0) {
    const pBloodList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0x72)
    const curseSkillId = pBloodList !== 0 ? STATLIST_GetSkillId113c(m, pBloodList) : -1
    const curHp = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
    if (curHp < cost) {
      const pSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0x72)
      if (pSub !== 0) {
        STATLIST_UnlinkSubList113c(m, pUnit, pSub)
        STATLIST_FreeStatListIfNonExtended113c(m, pSub)
      }
      STATLIST_SetUnitStat113c(m, pUnit, 6, 0x100, 0)
      return 0
    }
    STATLIST_AddUnitStatMemPort113c(m, pUnit, 6, -cost, 0)
    const pCurseTxt = curseSkillId >= 0 ? SKILLS_GetRecordPtrFast113c(m, curseSkillId) : 0
    const minHpFloor = pCurseTxt !== 0 ? ((m.u32((pCurseTxt + 0x158) >>> 0) | 0) << 8) : 0
    const remHp = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
    if (remHp < minHpFloor) {
      const pSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0x72)
      if (pSub !== 0) {
        STATLIST_UnlinkSubList113c(m, pUnit, pSub)
        STATLIST_FreeStatListIfNonExtended113c(m, pSub)
      }
    }
    return 1
  }

  const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0
  if (curMana < cost) return 0
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 8, -cost, 0)
  return 1
}

/** Sends 12-byte S2C `0x22` (`UNIT_SKILL_QUANTITY`) packet to `pClient`. */
function sendPacket0x22SkillCharges(
  m: Memory113c,
  pClient: number,
  nUnitType: number,
  dwUnitId: number,
  wSkillId: number,
  nCharges: number,
): void {
  if (pClient === 0) {
    throw new Error('sendPacket0x22SkillCharges: pClient == NULL (line 2454)')
  }
  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x0c, 0)
    m.setU8(sp, 0x22)
    m.setU8((sp + 0x01) >>> 0, nUnitType & 0xff)
    m.setU32((sp + 0x03) >>> 0, dwUnitId >>> 0)
    m.setU16((sp + 0x07) >>> 0, wSkillId & 0xffff)
    m.setU8((sp + 0x09) >>> 0, nCharges & 0xff)

    const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
    const pTarget = SUNIT_GetServerUnit113c(m, pGame, nUnitType & 0xff, dwUnitId >>> 0)
    let inCorpState = 0
    if (pTarget !== 0 && STATES_CheckState113c(m, pTarget, 7) !== 0) {
      inCorpState = 1
    }
    m.setU8((sp + 0x0b) >>> 0, inCorpState)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x0c)
  } finally {
    itemdefGapStackPtr = sp
  }
}

/** Sends 12-byte S2C `0x21` (`PLAYER_UPDATE_SKILL`) packet to `pClient` (or minion owner). */
function sendPacket0x21UpdateSkill(
  m: Memory113c,
  pClientArg: number,
  pUnit: number,
  wSkillId: number,
  nBaseLevel: number,
  bFlag: number,
): void {
  if (pUnit === 0) return
  let pClient = pClientArg >>> 0
  if (pClient === 0) {
    if ((m.u32(pUnit >>> 0) | 0) !== 1) return
    const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pUnit)
    if (pOwner === 0 || (m.u32(pOwner >>> 0) | 0) !== 0) return
    const pPlayerData = UNITS_GetPlayerData113c(m, pOwner)
    if (pPlayerData === 0) return
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    if (pClient === 0) return
  }

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x0c, 0)
    m.setU8(sp, 0x21)
    m.setU8((sp + 0x01) >>> 0, m.u32(pUnit >>> 0) & 0xff)
    m.setU8((sp + 0x02) >>> 0, bFlag & 0xff)
    m.setU32((sp + 0x03) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
    m.setU16((sp + 0x07) >>> 0, wSkillId & 0xffff)
    m.setU8((sp + 0x09) >>> 0, nBaseLevel & 0xff)
    const bonus = SKILLS_GetUnitSkillBonusBySkillId113c(m, pUnit, wSkillId & 0xffff)
    m.setU8((sp + 0x0a) >>> 0, bonus & 0xff)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x0c)
  } finally {
    itemdefGapStackPtr = sp
  }
}

/** Sends 13-byte S2C `0x23` (`PLAYER_SET_SKILL`) packet to `pClient`. */
function sendPacket0x23AssignSkill(
  m: Memory113c,
  pClient: number,
  nUnitType: number,
  dwUnitId: number,
  bHand: number,
  wSkillId: number,
  dwItemGuid: number,
): void {
  if (pClient === 0) return
  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x0d, 0)
    m.setU8(sp, 0x23)
    m.setU8((sp + 0x01) >>> 0, nUnitType & 0xff)
    m.setU32((sp + 0x02) >>> 0, dwUnitId >>> 0)
    m.setU8((sp + 0x06) >>> 0, bHand & 0xff)
    m.setU16((sp + 0x07) >>> 0, wSkillId & 0xffff)
    m.setU32((sp + 0x09) >>> 0, dwItemGuid >>> 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x0d)
  } finally {
    itemdefGapStackPtr = sp
  }
}

/** Updates pet/summon max caps in `pPlayerData + 0x44` when present. */
function syncPlayerPetSkillCaps(m: Memory113c, pGame: number, pUnit: number): void {
  void pGame
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 0) return
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
  if (pPlayerData === 0) return
  const pPetHolder = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetHolder === 0) return
  const pSkillList = m.u32((pUnit + 0xa8) >>> 0) >>> 0
  if (pSkillList === 0) return
  const pTables = readSgptDataTables(m)
  if (pTables === 0) return
  const nPetTypes = m.u32((pTables + 0xbf0) >>> 0) | 0
  if (nPetTypes <= 0) return

  const maxCaps = new Int32Array(256)
  let pSkill = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillList)
  while (pSkill !== 0) {
    const pNext = SKILLS_GetNextSkill113c(m, pSkill)
    const skillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
    const sLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
    if (pSkillsTxt !== 0) {
      const petType = sx8(m.u8((pSkillsTxt + 0xbe) >>> 0))
      if (petType > 0 && petType < nPetTypes && petType < 256) {
        const calcVal = m.u32((pSkillsTxt + 0xc0) >>> 0)
        let cap = SKILLS_EvalCalcByOffset113c(m, pUnit, calcVal, skillId, sLvl) | 0
        if (cap < 1) cap = 1
        if (cap > maxCaps[petType]!) {
          maxCaps[petType] = cap
          const pArr = m.u32(pPetHolder >>> 0) >>> 0
          if (pArr !== 0) {
            m.setU32((pArr + petType * 12 + 0x08) >>> 0, cap >>> 0)
          }
        }
      }
    }
    pSkill = pNext
  }

  const pPetTypesBase = m.u32((pTables + 0xbe8) >>> 0) >>> 0
  const pArr = m.u32(pPetHolder >>> 0) >>> 0
  if (pPetTypesBase !== 0 && pArr !== 0) {
    for (let pt = 0; pt < nPetTypes && pt < 256; pt++) {
      if (maxCaps[pt]! <= 0) {
        const pRec = (pPetTypesBase + Math.imul(pt, 0xe0)) >>> 0
        const defCap = sx16(m.u16((pRec + 0x0a) >>> 0))
        m.setU32((pArr + pt * 12 + 0x08) >>> 0, defCap >>> 0)
      }
    }
  }
}

/** Learns/grants `nSkillId` using skill points (`STAT_NEW_SKILLS = 5`) on `pUnit`. */
function learnSkillFromPointsOrScroll(
  m: Memory113c,
  nSkillId: number,
  pUnit: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0 || pUnit === 0) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return 0

  let cost = 1
  const skPointsCalc = m.u32((pSkillsTxt + 0x170) >>> 0) | 0
  if (skPointsCalc !== -1) {
    cost = 0
    const pExisting = SKILLS_GetSkillById113c(m, pUnit, skillId, -1)
    let curLvl = 0
    if (pExisting !== 0) {
      curLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pExisting, 1) | 0
    }
    cost = SKILLS_EvalCalcByOffset113c(m, pUnit, skPointsCalc, skillId, curLvl) | 0
  }

  const availPts = STATLIST_GetUnitBaseStat113c(m, pUnit, 5, 0) | 0
  if (availPts < cost) return 0

  STATLIST_AddUnitStatMemPort113c(m, pUnit, 5, -cost, 0)
  const pAddedSkill = SKILLS_AddSkillToUnit113c(m, pUnit, skillId)
  SKILLS_RefreshPassiveAuraSkills113c(m, pUnit)

  if ((m.u32(pUnit >>> 0) | 0) === 0) {
    syncPlayerPetSkillCaps(m, m.u32((pUnit + 0x80) >>> 0), pUnit)
  }

  if (pAddedSkill === 0) {
    STATLIST_AddUnitStatMemPort113c(m, pUnit, 5, cost, 0)
    return 0
  }

  const newLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pAddedSkill, 0) | 0
  let pClient = 0
  if ((m.u32(pUnit >>> 0) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    if (pPlayerData !== 0) {
      pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    }
  }
  sendPacket0x21UpdateSkill(m, pClient, pUnit, skillId, newLvl, 0)

  const passiveState = SKILLS_GetPassiveState113c(m, skillId) | 0
  if (passiveState !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, passiveState, 1)
  }
  STATES_ApplyMonSkillIconToUnit113c(m, pUnit, skillId)
  return 1
}

/** Assigns left (`bLeft != 0`) or right (`bLeft == 0`) skill slot on `pUnit` and syncs auras. */
function assignUnitHandSkillSlot(
  m: Memory113c,
  pUnit: number,
  bLeft: number,
  nSkillId: number,
  dwOwnerGuid: number,
): void {
  const skillId = nSkillId | 0
  if (skillId === 5 || pUnit === 0) return

  if (bLeft === 0 && STATES_CheckState113c(m, pUnit, 0x55) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x55, 0)
  }

  const pSkill = SKILLS_GetSkillById113c(m, pUnit, skillId, dwOwnerGuid)
  if (pSkill === 0) return

  let pOldRightSkill = 0
  if (bLeft !== 0) {
    SKILLS_SetLeftSkill113c(m, pUnit, skillId, dwOwnerGuid)
  } else {
    pOldRightSkill = UNITS_GetRightSkill113c(m, pUnit)
    SKILLS_SetRightSkill113c(m, pUnit, skillId, dwOwnerGuid)
  }

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 8) >>> 0
  let resolvedItemGuid = -1
  try {
    m.setU32(sp, 0xffffffff)
    SKILLS_GetItemSkillInfo113c(m, pSkill, sp, 0, 0, 0)
    resolvedItemGuid = m.u32(sp) | 0
  } finally {
    itemdefGapStackPtr = sp
  }

  const unitType = m.u32(pUnit >>> 0) | 0
  if (unitType === 0) {
    const unitId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pClient = pPlayerData !== 0 ? (m.u32((pPlayerData + 0x9c) >>> 0) >>> 0) : 0
    sendPacket0x23AssignSkill(m, pClient, unitType, unitId, bLeft, skillId, resolvedItemGuid >>> 0)
  }

  if (bLeft !== 0) return

  if (pOldRightSkill !== 0) {
    const oldId = SKILLS_GetSkillIdFromSkill113c(m, pOldRightSkill, 0, 0) | 0
    const pOldTxt = SKILLS_GetRecordPtrFast113c(m, oldId)
    if (pOldTxt !== 0 && (m.u8((pOldTxt + 0x04) >>> 0) & readGdwBitMaskByte(m, 0x14)) !== 0) {
      const auraState = sx16(m.u16((pOldTxt + 0x80) >>> 0))
      const pTables = readSgptDataTables(m)
      const nStates = pTables !== 0 ? (m.u32((pTables + 0xc4) >>> 0) | 0) : 0
      if (auraState >= 0 || auraState < nStates) {
        const pSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, auraState)
        if (pSub !== 0) {
          STATLIST_UnlinkSubList113c(m, pUnit, pSub)
          STATLIST_FreeStatListIfNonExtended113c(m, pSub)
        }
        STATES_ToggleGfxStateFlag113c(m, pUnit, auraState, 0)
      }
      const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pUnit)
      let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pEv !== 0) {
        const pNextEv = m.u32((pEv + 0x24) >>> 0) >>> 0
        if (m.u8(pEv) === 8 && (m.u32((pEv + 0x14) >>> 0) | 0) === -1) {
          EVENT_FreeNode113c(m, pGame, pEv)
        }
        pEv = pNextEv
      }
    }
  }

  const pNewTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pNewTxt !== 0 && (m.u8((pNewTxt + 0x04) >>> 0) & readGdwBitMaskByte(m, 0x14)) !== 0) {
    const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pUnit)
    SKILLS_ActivateAuraSkillOnUnit113c(m, pUnit, pGame, skillId)
  }
}

/** Picks up to 10 random walkable offsets in `[-20..+19]` around `pUnit` and sets path target pos. */
function pickRandomTriggeredSkillPosition(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return 0
  const baseX = UNIT_GetPosX113c(m, pUnit) | 0
  const baseY = UNIT_GetPosY113c(m, pUnit) | 0
  const pSeed = (pUnit + 0x20) >>> 0
  const collPattern = PATH_GetUnitCollisionPattern113c(m, pUnit)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const collMask = PATH_GetFootprintCollisionMask113c(m, pPath)

  for (let attempt = 0; attempt < 10; attempt++) {
    const lo0 = m.u32(pSeed) >>> 0
    const hi0 = m.u32((pSeed + 4) >>> 0) >>> 0
    const prod1 = BigInt(lo0) * 0x6ac690c5n + BigInt(hi0)
    const lo1 = Number(prod1 & 0xffffffffn) >>> 0
    const hi1 = Number((prod1 >> 32n) & 0xffffffffn) >>> 0
    m.setU32(pSeed, lo1)
    const dx = ((lo1 % 40) | 0) - 20
    const candX = (baseX + dx) | 0

    const prod2 = BigInt(lo1) * 0x6ac690c5n + BigInt(hi1)
    const lo2 = Number(prod2 & 0xffffffffn) >>> 0
    const hi2 = Number((prod2 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed + 4) >>> 0, hi2)
    m.setU32(pSeed, lo2)
    const dy = ((lo2 % 40) | 0) - 20
    const candY = (baseY + dy) | 0

    const blocked =
      COLLISION_GetMaskWithPattern2_113c(m, pRoom, candX, candY, collPattern, collMask) & 0xffff
    if (blocked === 0) {
      PATH_SetTargetPos113c(m, pPath, candX, candY)
      return 1
    }
  }
  return 0
}

/** Resolves current path target or falls back to `SUNIT_GetLastAttacker` for triggered skill mode 4. */
function resolveTriggeredSkillTargetOrAttacker(
  m: Memory113c,
  pGame: number,
  pCaster: number,
  pOutTargetType: number,
  pOutTargetId: number,
): number {
  SUNIT_ValidatePathTargetUnit113c(m, pCaster, pGame)
  const pPath = m.u32((pCaster + 0x2c) >>> 0) >>> 0
  const pCurTarget = PATH_GetTargetUnit113c(m, pPath)
  if (pCurTarget !== 0 && pCurTarget !== pCaster) {
    return 1
  }
  const pAttacker = SUNIT_GetLastAttacker113c(m, pGame, pCaster)
  UNITS_SetTargetUnitForDynamicUnit113c(m, pCaster, pAttacker)
  if (pOutTargetType !== 0) {
    if (pAttacker === 0) {
      m.setU32(pOutTargetType >>> 0, 6)
      if (pOutTargetId !== 0) {
        m.setU32(pOutTargetId >>> 0, 0xffffffff)
      }
    } else {
      m.setU32(pOutTargetType >>> 0, m.u32(pAttacker >>> 0))
      if (pOutTargetId !== 0) {
        m.setU32(pOutTargetId >>> 0, m.u32((pAttacker + 0x0c) >>> 0))
      }
    }
  }
  return 1
}

/** Finds a selectable corpse within radius 10 around current path target for triggered skill mode 3. */
function resolveTriggeredSkillCorpseTarget(
  m: Memory113c,
  pGame: number,
  pCaster: number,
  nSkillId: number,
  nSkillLevel: number,
  pOutTargetType: number,
  pOutTargetId: number,
): number {
  void nSkillId
  SUNIT_ValidatePathTargetUnit113c(m, pCaster, pGame)
  const pPath = m.u32((pCaster + 0x2c) >>> 0) >>> 0
  let pAnchor = PATH_GetTargetUnit113c(m, pPath)
  if (pAnchor === pCaster) pAnchor = 0
  if (pCaster === 0 || (nSkillLevel | 0) <= 0 || pAnchor === 0 || pGame === 0) {
    return 0
  }

  const anchorX = UNIT_GetPosX113c(m, pAnchor) | 0
  const anchorY = UNIT_GetPosY113c(m, pAnchor) | 0
  const pRoom = UNITS_GetRoom113c(m, pAnchor)
  if (pRoom === 0) return 0

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x70) >>> 0
  const pFindData = sp
  const pFindArg = (sp + 0x38) >>> 0
  let pCorpse = 0
  try {
    m.fill(pFindData, 0x70, 0)
    m.setU32(pFindArg, 0x1002)
    m.setU32((pFindArg + 0x0c) >>> 0, anchorX >>> 0)
    m.setU32((pFindArg + 0x10) >>> 0, anchorY >>> 0)
    m.setU32((pFindArg + 0x14) >>> 0, 10)

    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    UNITFINDS_InitUnitFindData113c(
      m,
      pMemPool,
      pFindData,
      pRoom,
      anchorX,
      anchorY,
      10,
      CORPSE_FIND_FILTER_VA_113C,
      pFindArg,
    )
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pFindData, (mem, pCand, pData) => {
      if (SKILLS_IsSelectableCorpse11157_113c(mem, pCand) === 0) return 0
      const pSearch = mem.u32((pData + 0x10) >>> 0) >>> 0
      return UNITFINDS_MatchUnitCandidate113c(mem, pCand, pSearch)
    })
    const nFound = m.u32((pFindData + 0x08) >>> 0) | 0
    if (nFound !== 0) {
      const pArr = m.u32((pFindData + 0x04) >>> 0) >>> 0
      if (pArr !== 0) {
        pCorpse = m.u32(pArr) >>> 0
      }
    }
    UNITFINDS_FreeUnitFindData113c(m, pFindData)
  } finally {
    itemdefGapStackPtr = sp
  }

  if (pCorpse === 0) return 0
  UNITS_SetTargetUnitForDynamicUnit113c(m, pCaster, pCorpse)
  if (pOutTargetType !== 0) {
    m.setU32(pOutTargetType >>> 0, m.u32(pCorpse >>> 0))
    if (pOutTargetId !== 0) {
      m.setU32(pOutTargetId >>> 0, m.u32((pCorpse + 0x0c) >>> 0))
    }
  }
  return 1
}

/** Appends a `0x9A` ground-coordinate skill notification node onto `pUnit + 0xEC/+0xF0`. */
function queueSkillCastGroundNotify9A(
  m: Memory113c,
  pUnit: number,
  wSkillId: number,
  nSkillLevel: number,
  nX: number,
  nY: number,
  bExtraFlag: number,
): void {
  if (pUnit === 0) return
  const pNode = m.alloc(0x14) >>> 0
  m.setU32(pNode, 0)
  m.setU8((pNode + 0x04) >>> 0, 0x9a)
  m.setU16((pNode + 0x08) >>> 0, wSkillId & 0xffff)
  m.setU8((pNode + 0x0a) >>> 0, nSkillLevel & 0xff)
  m.setU16((pNode + 0x0c) >>> 0, nX & 0xffff)
  m.setU16((pNode + 0x0e) >>> 0, nY & 0xffff)
  m.setU8((pNode + 0x10) >>> 0, bExtraFlag & 0xff)

  if (m.u32((pUnit + 0xec) >>> 0) === 0) {
    m.setU32((pUnit + 0xec) >>> 0, pNode)
  }
  const pOldTail = m.u32((pUnit + 0xf0) >>> 0) >>> 0
  if (pOldTail !== 0) {
    m.setU32(pOldTail, pNode)
  }
  m.setU32((pUnit + 0xf0) >>> 0, pNode)
  UNITROOM_RefreshUnit113c(m, pUnit)
}

/** Casts a ground-targeted triggered skill at `(nX, nY)` and queues `0x9A` event notification. */
function triggerSkillAtCoords(
  m: Memory113c,
  pCaster: number,
  nY: number,
  nSkillId: number,
  nSkillLevel: number,
  nX: number,
  bConsumeMana: number,
): number {
  if (pCaster === 0) return 0
  const pGame = m.u32((pCaster + 0x80) >>> 0) >>> 0
  if (pGame === 0) return 0
  if (STATES_CheckState113c(m, pCaster, 0x36) !== 0) return 0

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x10) >>> 0
  const pOutX = sp
  const pOutY = (sp + 4) >>> 0
  try {
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    const ok = SKILLS_CastTriggeredSkillCore113c(
      m,
      0,
      pCaster,
      pGame,
      nSkillId,
      nSkillLevel,
      nX,
      nY,
      0,
      0,
      pOutX,
      pOutY,
      bConsumeMana,
    )
    if (ok === 0) return 0
    let finalX = m.u32(pOutX) | 0
    let finalY = m.u32(pOutY) | 0
    if (finalX === 0) {
      finalX = nX | 0
      finalY = nY | 0
    }
    queueSkillCastGroundNotify9A(m, pCaster, nSkillId, nSkillLevel, finalX, finalY, bConsumeMana)
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}

// ===========================================================================
// Exported 32 Target `D2Game.dll` VAs
// ===========================================================================

/**
 * Fast register lookup of `D2ItemStatCostTxt*` (`sgptDataTables + 0xBCC`, stride `0x144`, count `+0xBD4`).
 *
 * @va D2Game:0x6FC210D0
 */
export function DATATBLS_GetItemStatCostRecordFast113c(
  m: Memory113c,
  nStatId: number,
): number {
  const id = nStatId | 0
  if (id < 0) return 0
  const pTables = readSgptDataTables(m)
  if (pTables === 0) return 0
  const count = m.u32((pTables + 0xbd4) >>> 0) | 0
  if (id >= count) return 0
  const pBase = m.u32((pTables + 0xbcc) >>> 0) >>> 0
  if (pBase === 0) return 0
  return (pBase + Math.imul(id, 0x144)) >>> 0
}

/**
 * Allocates a `0x20`-byte `D2UnitEventStrc` node and prepends it to `pUnit->pUnitEventList` (`+0x90`).
 *
 * @va D2Game:0x6FC57190
 */
export function UNITEVENT_RegisterTimerOrItemEventNode113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nEventType: number,
  dwArg1: number,
  dwArg2: number,
  pfnCallback: number,
  nFuncType: number,
  dwGuid: number,
): number {
  if (pUnit === 0) return 0
  void pGame
  const pNode = m.alloc(0x20) >>> 0
  m.fill(pNode, 0x20, 0)
  m.setU8(pNode, nEventType & 0xff)
  m.setU32((pNode + 0x04) >>> 0, nFuncType >>> 0)
  m.setU32((pNode + 0x08) >>> 0, dwGuid >>> 0)
  m.setU32((pNode + 0x0c) >>> 0, dwArg1 >>> 0)
  m.setU32((pNode + 0x10) >>> 0, dwArg2 >>> 0)
  m.setU32((pNode + 0x14) >>> 0, pfnCallback >>> 0)

  const pOldHead = m.u32((pUnit + 0x90) >>> 0) >>> 0
  m.setU32((pNode + 0x1c) >>> 0, pOldHead)
  if (pOldHead !== 0) {
    m.setU32((pOldHead + 0x18) >>> 0, pNode)
  }
  m.setU32((pUnit + 0x90) >>> 0, pNode)
  return pNode
}

/**
 * Radial callback for Sorceress Static Field (`SrvDoFunc #20`): computes percentage HP reduction,
 * enforces difficulty HP floor and negative-resistance cap, and applies lightning damage.
 *
 * @va D2Game:0x6FC62EC0
 */
export function SKILLS_CallbackStaticField113c(
  m: Memory113c,
  pAuraCtx: number,
  pTarget: number,
): number {
  if (pAuraCtx === 0 || pTarget === 0) return 0
  const pAttacker = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
  const pStaticArgs = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  if (pStaticArgs === 0) return 0

  const curHpWhole = (STATLIST_GetUnitStat113c(m, pTarget, 6, 0) | 0) >> 8
  if (curHpWhole < 1) return 0

  const capPct = m.u32((pStaticArgs + 0x08) >>> 0) | 0
  if (capPct !== 0) {
    const maxHpWhole = (STATLIST_GetMaxLifeFromUnit113c(m, pTarget) | 0) >> 8
    const floorHp = mulDiv113c(capPct, maxHpWhole, 100) | 0
    if (curHpWhole <= floorHp) return 0
  }

  const pct = m.u32((pStaticArgs + 0x04) >>> 0) | 0
  let dmgWhole = scaleSignedPercent64(curHpWhole, pct)
  if (((curHpWhole - dmgWhole) | 0) < 1) {
    dmgWhole = (curHpWhole - 1) | 0
  }

  let dmg256 = (dmgWhole << 8) | 0
  const minDmg256 = m.u32(pStaticArgs) | 0
  if (dmg256 < minDmg256) {
    dmg256 = minDmg256
  }

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x80) >>> 0
  const pOutResStat = sp
  const pActualElemType = (sp + 4) >>> 0
  const pDmg = (sp + 8) >>> 0
  try {
    m.fill(pDmg, 0x70, 0)
    const nLength = m.u32((pStaticArgs + 0x0c) >>> 0) | 0
    const eElemType = m.u32((pStaticArgs + 0x10) >>> 0) | 0
    m.setU32(pOutResStat, 0xffffffff)
    m.setU32(pActualElemType, eElemType >>> 0)

    SUNITDMG_AddElementalDamageToStruct113c(
      m,
      pDmg,
      eElemType,
      pAttacker,
      dmg256,
      nLength,
      pOutResStat,
      pActualElemType,
    )

    const resStatId = m.u32(pOutResStat) | 0
    if (resStatId >= 0) {
      const targetRes = STATLIST_GetUnitStat113c(m, pTarget, resStatId, 0) | 0
      if (targetRes < 0) {
        const denom = (100 - targetRes) | 0
        if (denom === 0) {
          dmg256 = 0
        } else if (dmg256 > 0x100000) {
          if (denom > (dmg256 >> 4)) {
            dmg256 = Number((BigInt(dmg256) * 100n) / BigInt(denom)) | 0
          } else {
            dmg256 = Math.imul(Math.trunc(dmg256 / denom) | 0, 100) | 0
          }
        } else {
          dmg256 = Math.trunc(Math.imul(dmg256, 100) / denom) | 0
        }
      }
    }

    m.fill(pDmg, 0x70, 0)
    const finalElemType = m.u32(pActualElemType) | 0
    SUNITDMG_AddElementalDamageToStruct113c(
      m,
      pDmg,
      finalElemType,
      pAttacker,
      dmg256,
      nLength,
      0,
      0,
    )

    const pGame = m.u32(pAuraCtx >>> 0) >>> 0
    const hitClass = (m.u32((pDmg + 0x60) >>> 0) | 0x0d) >>> 0
    m.setU32((pDmg + 0x60) >>> 0, hitClass)
    m.setU8((pDmg + 0x64) >>> 0, 1)
    m.setU16((pDmg + 0x04) >>> 0, 0x4001)

    SUNITDMG_ApplyDamage113c(m, pGame, pAttacker, pTarget, pDmg)
    applyPostDamageHitReaction(m, pGame, pAttacker, pTarget, pDmg)
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * `SrvDoFunc` #20: Sorceress Static Field (`D2Game.dll` `0x6FC630D0`).
 *
 * @va D2Game:0x6FC630D0
 */
export function SrvDoFunc_020_StaticField113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0 || pGame === 0) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return 0

  const diff = m.u8((pGame + 0x6d) >>> 0)
  const pMonLvlTxt = DATATBLS_GetMonLvlTxtRecord113c(m, diff)
  if (pMonLvlTxt === 0) return 0

  const minDmg256 = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillsTxt + 0x13c) >>> 0),
    skillId,
    nSkillLevel,
  )
  const pct = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillsTxt + 0x138) >>> 0),
    skillId,
    nSkillLevel,
  )
  const isExpansion = m.u32((pGame + 0x70) >>> 0) !== 0
  const capPct = isExpansion ? (m.u32((pMonLvlTxt + 0x40) >>> 0) | 0) : 0
  const nLength = SKILLS_GetSkillPeriodicDelayOrLength113c(m, pUnit, skillId, nSkillLevel, 1)
  const eElemType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
  const nRadius = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillsTxt + 0x64) >>> 0),
    skillId,
    nSkillLevel,
  )
  const dwAuraFilter = m.u32((pSkillsTxt + 0x50) >>> 0)

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x18) >>> 0
  try {
    m.setU32(sp, minDmg256 >>> 0)
    m.setU32((sp + 0x04) >>> 0, pct >>> 0)
    m.setU32((sp + 0x08) >>> 0, capPct >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nLength >>> 0)
    m.setU32((sp + 0x10) >>> 0, eElemType >>> 0)

    AURA_ForEachUnitInRadius113c(
      m,
      pGame,
      pUnit,
      0,
      0,
      nRadius,
      dwAuraFilter,
      STATIC_FIELD_CALLBACK_VA_113C,
      sp,
      0,
    )
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * Scales negative resistance penalties (`36, 37, 39, 41, 43, 45`) to 1/5th (`Math.trunc(nValue / 5)`)
 * when `pTargetUnit` is a non-hireling monster with base resistance `>= 100` (immune).
 *
 * @va D2Game:0x6FC6E230
 */
export function CURSES_ScaleImmuneMonsterResistPenalty113c(
  m: Memory113c,
  nStatId: number,
  nValue: number,
  pTargetUnit: number,
): number {
  const statId = nStatId | 0
  const val = nValue | 0
  const isPrimaryResist =
    statId === 36 ||
    statId === 37 ||
    statId === 39 ||
    statId === 41 ||
    statId === 43 ||
    statId === 45
  if (!isPrimaryResist) return val
  if (val > 0) return val
  if (pTargetUnit !== 0 && (m.u32(pTargetUnit >>> 0) | 0) === 0) return val
  if (MONSTERS_GetHirelingTypeId113c(m, pTargetUnit) !== 0) return val
  const baseRes = STATLIST_GetUnitBaseStat113c(m, pTargetUnit, statId, 0) | 0
  if (baseRes < 100) return val
  return Math.trunc(val / 5) | 0
}

/**
 * Monster mode `15` (`MONMODE_RUN`) `pfnStart` handler: verifies non-zero path points,
 * clears attacker combat list, and transitions anim mode to `15`.
 *
 * @va D2Game:0x6FC94C30
 */
export function MONSTER_StartModeRun113c(
  m: Memory113c,
  pGame: number,
  pModeArgs: number,
): number {
  if (pModeArgs === 0) return 0
  const pUnit = m.u32((pModeArgs + 0x04) >>> 0) >>> 0
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const numPts = PATH_GetNumberOfPathPoints113c(m, pPath) | 0
  if (numPts === 0) return 0
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame)
  UNITS_ChangeAnimMode113c(m, pUnit, 0x0f)
  return 1
}

/**
 * Player timer event `0x0C` handler: expires timed stat sublists up to `pGame->dwGameFrame` (`+0xA8`).
 *
 * @va D2Game:0x6FC97820
 */
export function PLAYER_Event0C_ExpireTimedStats113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _arg14 = 0,
  _arg18 = 0,
): void {
  void _arg14
  void _arg18
  if (pGame === 0) return
  const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  STATLIST_ExpireTimedSubLists113c(m, pUnit, curFrame)
}

/**
 * Allocates a `0x14`-byte `0x99` targeted-skill notification node, appends it to
 * `pUnit + 0xEC` / `pUnit + 0xF0`, and marks the unit refreshed in its room.
 *
 * @va D2Game:0x6FC9A4C0
 */
export function UNIT_QueueSkillCastNotify99_113c(
  m: Memory113c,
  pUnit: number,
  wSkillId: number,
  nSkillLevel: number,
  nTargetType: number,
  dwTargetId: number,
  bExtraFlag: number,
): void {
  if (pUnit === 0) return
  const pNode = m.alloc(0x14) >>> 0
  m.setU32(pNode, 0)
  m.setU8((pNode + 0x04) >>> 0, 0x99)
  m.setU16((pNode + 0x08) >>> 0, wSkillId & 0xffff)
  m.setU8((pNode + 0x0a) >>> 0, nSkillLevel & 0xff)
  m.setU8((pNode + 0x0b) >>> 0, nTargetType & 0xff)
  m.setU32((pNode + 0x0c) >>> 0, dwTargetId >>> 0)
  m.setU8((pNode + 0x10) >>> 0, bExtraFlag & 0xff)

  if (m.u32((pUnit + 0xec) >>> 0) === 0) {
    m.setU32((pUnit + 0xec) >>> 0, pNode)
  }
  const pOldTail = m.u32((pUnit + 0xf0) >>> 0) >>> 0
  if (pOldTail !== 0) {
    m.setU32(pOldTail, pNode)
  }
  m.setU32((pUnit + 0xf0) >>> 0, pNode)
  UNITROOM_RefreshUnit113c(m, pUnit)
}

/**
 * Serializes and queues a unit-targeted skill action packet (`0x4C`/`0x99` when target is missing
 * or in an adjacent room of `pClient`, else `0x4D`/`0x9A` ground fallback) to `pClient`.
 *
 * @va D2Game:0x6FCAD210
 */
export function NET_SendUnitTargetedSkillAction113c(
  m: Memory113c,
  pClient: number,
  bIsTriggeredSkill: number,
  bOwnerType: number,
  dwOwnerId: number,
  bTargetType: number,
  dwTargetId: number,
  wSkillId: number,
  wExtra: number,
  nSkillLevel: number,
): void {
  if (pClient === 0) {
    throw new Error('NET_SendUnitTargetedSkillAction113c: pClient == NULL (line 2454)')
  }

  const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
  const pTarget = SUNIT_GetServerUnit113c(m, pGame, bTargetType & 0xff, dwTargetId >>> 0)

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x28) >>> 0
  const ppRooms = sp
  const pRoomCount = (sp + 4) >>> 0
  const pPkt = (sp + 8) >>> 0
  try {
    let sendUnitTarget = pTarget === 0
    if (!sendUnitTarget) {
      const pPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0)
      const pPlayerRoom = UNITS_GetRoom113c(m, pPlayer)
      if (pPlayerRoom !== 0) {
        m.setU32(ppRooms, 0)
        m.setU32(pRoomCount, 0)
        DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlayerRoom, ppRooms, pRoomCount)
        const pTargetRoom = UNITS_GetRoom113c(m, pTarget)
        const count = m.u32(pRoomCount) | 0
        const pList = m.u32(ppRooms) >>> 0
        for (let i = 0; i < count; i++) {
          if ((m.u32((pList + i * 4) >>> 0) >>> 0) === (pTargetRoom >>> 0)) {
            sendUnitTarget = true
            break
          }
        }
      }
    }

    if (sendUnitTarget) {
      m.fill(pPkt, 0x10, 0)
      m.setU8(pPkt, bIsTriggeredSkill === 0 ? 0x4c : 0x99)
      m.setU8((pPkt + 0x01) >>> 0, bOwnerType & 0xff)
      m.setU32((pPkt + 0x02) >>> 0, dwOwnerId >>> 0)
      m.setU16((pPkt + 0x06) >>> 0, wSkillId & 0xffff)
      m.setU8((pPkt + 0x08) >>> 0, nSkillLevel & 0xff)
      m.setU8((pPkt + 0x09) >>> 0, bTargetType & 0xff)
      m.setU32((pPkt + 0x0a) >>> 0, dwTargetId >>> 0)
      m.setU16((pPkt + 0x0e) >>> 0, wExtra & 0xffff)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x10)
      return
    }

    const pTargetPath = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    const targetY = PATH_GetFirstPointY113c(m, pTargetPath) & 0xffff
    const targetX = PATH_GetFirstPointX113c(m, pTargetPath) & 0xffff

    m.fill(pPkt, 0x11, 0)
    m.setU8(pPkt, bIsTriggeredSkill === 0 ? 0x4d : 0x9a)
    m.setU8((pPkt + 0x01) >>> 0, bOwnerType & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, dwOwnerId >>> 0)
    m.setU32((pPkt + 0x06) >>> 0, wSkillId & 0xffff)
    m.setU8((pPkt + 0x0a) >>> 0, nSkillLevel & 0xff)
    m.setU16((pPkt + 0x0b) >>> 0, targetX)
    m.setU16((pPkt + 0x0d) >>> 0, targetY)
    m.setU16((pPkt + 0x0f) >>> 0, wExtra & 0xffff)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x11)
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * Radial callback that creates/updates an aura `D2StatListStrc` on `pTargetUnit` and applies up to
 * 6 evaluated aura stats (including `STAT_ITEM_RESTINPEACE`/`0x6E` Cleansing duration reduction,
 * immune-monster resistance scaling, velocity floors, and `fDirect` pool stats like Prayer healing).
 *
 * @va D2Game:0x6FCBA1A0
 */
export function AURAS_ApplyRadialStatBuffCallback113c(
  m: Memory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  if (pAuraCtx === 0 || pTargetUnit === 0) return 0
  const pSourceUnit = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
  const pDesc = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  if (pDesc === 0) return 0

  const stateId = m.u32(pDesc) | 0
  const skillId = m.u32((pDesc + 0x04) >>> 0) | 0
  const skillLevel = m.u32((pDesc + 0x08) >>> 0) | 0
  const durationFrames = m.u32((pDesc + 0x0c) >>> 0) | 0
  let pfnRemove = m.u32((pDesc + 0x4c) >>> 0) >>> 0
  if (pfnRemove === 0 && pSourceUnit === (pTargetUnit >>> 0)) {
    pfnRemove = SELF_AURA_REMOVE_PROC_VA_113C
  }

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x28) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp, pSourceUnit)
    m.setU32((sp + 0x04) >>> 0, pTargetUnit >>> 0)
    m.setU32((sp + 0x08) >>> 0, skillId >>> 0)
    m.setU32((sp + 0x0c) >>> 0, skillLevel >>> 0)
    m.setU32((sp + 0x10) >>> 0, durationFrames >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0xffffffff)
    m.setU32((sp + 0x18) >>> 0, 0)
    m.setU32((sp + 0x1c) >>> 0, stateId >>> 0)
    m.setU32((sp + 0x20) >>> 0, pfnRemove)

    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, sp)
    if (pStatList === 0) return 0
    m.setU32((pDesc + 0x44) >>> 0, pStatList >>> 0)

    const pTables = readSgptDataTables(m)
    const nItemStatCount = pTables !== 0 ? (m.u32((pTables + 0xbd4) >>> 0) | 0) : 0
    const maskBit4 = readGdwBitMaskByte(m, 0x10)

    for (let slot = 0; slot < 6; slot++) {
      let statVal = m.u32((pDesc + 0x28 + slot * 4) >>> 0) | 0
      if (statVal === 0) continue
      const statId = m.u32((pDesc + 0x10 + slot * 4) >>> 0) | 0
      if (statId <= 0 || statId >= nItemStatCount) continue

      if (statId === 0x6e) {
        const pGame = m.u32(pAuraCtx >>> 0) >>> 0
        if (reduceCurseAndColdDurations(m, statVal, pGame, pTargetUnit) !== 0) {
          m.setU32((pDesc + 0x40) >>> 0, ((m.u32((pDesc + 0x40) >>> 0) | 0) + 1) >>> 0)
        }
        continue
      }

      statVal = CURSES_ScaleImmuneMonsterResistPenalty113c(m, statId, statVal, pTargetUnit)
      if (statVal === 0) continue

      const pIsc = DATATBLS_GetItemStatCostRecordFast113c(m, statId)
      if (pIsc === 0) continue
      const iscFlags = m.u8((pIsc + 0x04) >>> 0)

      if ((iscFlags & maskBit4) === 0) {
        const prevVal = STATLIST_GetStatValue113c(m, pStatList, statId, 0) | 0
        if (prevVal !== statVal) {
          STATES_ClearGfxStateFlag113c(m, pTargetUnit, stateId, 1)
        }
        if (statId >= 0x43 && statId <= 0x44) {
          const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pTargetUnit)
          const velFloor = getMonsterVelocityFloor(m, pTargetUnit, pGame)
          if (statVal < velFloor) statVal = velFloor
        }
        STATLIST_SetStat113c(m, pStatList, statId, statVal, 0)
        if (statId === 0x44) {
          STATLIST_SetStat113c(m, pStatList, 0x45, statVal, 0)
        }
        m.setU32((pDesc + 0x40) >>> 0, ((m.u32((pDesc + 0x40) >>> 0) | 0) + 1) >>> 0)
      } else {
        const curPool = STATLIST_GetUnitStat113c(m, pTargetUnit, statId, 0) | 0
        let newPool = (curPool + statVal) | 0
        const maxStatId = m.u16((pIsc + 0x32) >>> 0)
        if (maxStatId < nItemStatCount) {
          const maxPool = STATLIST_GetUnitStat113c(m, pTargetUnit, maxStatId, 0) | 0
          if (newPool >= maxPool) newPool = maxPool
        }
        if (newPool !== curPool) {
          STATLIST_SetUnitStat113c(m, pTargetUnit, statId, newPool, 0)
          m.setU32((pDesc + 0x40) >>> 0, ((m.u32((pDesc + 0x40) >>> 0) | 0) + 1) >>> 0)
        }
      }
    }

    UNITS_SetUnitAnimMode113c(m, pTargetUnit, 0, 0x19d)
    STATLIST_SetStat113c(m, pStatList, 0x15e, skillId, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15f, skillLevel, 0)

    const clearStateId = m.u32((pDesc + 0x48) >>> 0) | 0
    if (clearStateId > 0) {
      const pClearList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
        m,
        pTargetUnit,
        clearStateId,
      )
      if (pClearList !== 0) {
        STATLIST_UnlinkSubList113c(m, pTargetUnit, pClearList)
        STATLIST_FreeStatListIfNonExtended113c(m, pClearList)
        STATES_ClearGfxStateFlag113c(m, pTargetUnit, clearStateId, 1)
      }
    }
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * `SrvDoFunc` #65: Paladin/Mercenary Radial Stat-Buff Aura (`Prayer`, `Defiance`, `Might`,
 * `Blessed Aim`, `Concentration`, `Fanaticism`, `Salvation`, `Cleansing`, `Meditation`, `Vigor`, etc.).
 *
 * @va D2Game:0x6FCBA8D0
 */
export function SrvDoFunc_065_AuraRadialStatBuff113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0 || pGame === 0) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return 0

  const manaCost256 = SKILLS_EvaluateManaCost256ths113c(m, skillId, nSkillLevel) | 0
  const curMana256 = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x68) >>> 0
  const pSelfCtx = sp
  const pDesc = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x60, 0)
    m.setU32((pDesc + 0x04) >>> 0, skillId >>> 0)
    m.setU32((pDesc + 0x08) >>> 0, nSkillLevel >>> 0)

    let lenCalc = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillsTxt + 0x128) >>> 0),
      skillId,
      nSkillLevel,
    ) | 0
    if (lenCalc <= 5) lenCalc = 5

    const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
    const nextGrid = Math.imul(Math.trunc(((curFrame + lenCalc - 1) | 0) / lenCalc) | 0, lenCalc) | 0
    const durFrames = ((nextGrid - curFrame + 2) | 0)
    m.setU32((pDesc + 0x0c) >>> 0, durFrames >>> 0)

    const wClearState = sx16(m.u16((pSkillsTxt + 0x94) >>> 0))
    if (wClearState > 0) {
      m.setU32((pDesc + 0x48) >>> 0, wClearState >>> 0)
    }

    const isPlayerWithoutMana =
      pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 0 && curMana256 < manaCost256
    if (!isPlayerWithoutMana) {
      for (let i = 0; i < 6; i++) {
        const statId = sx16(m.u16((pSkillsTxt + 0x54 + i * 2) >>> 0))
        if (statId < 0) break
        m.setU32((pDesc + 0x10 + i * 4) >>> 0, statId >>> 0)
        const calcExpr = m.u32((pSkillsTxt + 0x68 + i * 4) >>> 0)
        const val = SKILLS_EvalCalcByOffset113c(m, pUnit, calcExpr, skillId, nSkillLevel)
        m.setU32((pDesc + 0x28 + i * 4) >>> 0, val >>> 0)
      }
    }

    const pTables = readSgptDataTables(m)
    const nStatesCount = pTables !== 0 ? (m.u32((pTables + 0xc4) >>> 0) | 0) : 0
    const nItemStatCount = pTables !== 0 ? (m.u32((pTables + 0xbd4) >>> 0) | 0) : 0

    const selfAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
    if (selfAuraState > 0 && selfAuraState < nStatesCount) {
      m.setU32(pDesc, selfAuraState >>> 0)
      m.setU32(pSelfCtx, pGame >>> 0)
      m.setU32((pSelfCtx + 0x04) >>> 0, pUnit >>> 0)
      m.setU32((pSelfCtx + 0x08) >>> 0, 0)
      m.setU32((pSelfCtx + 0x0c) >>> 0, pDesc >>> 0)

      AURAS_ApplyRadialStatBuffCallback113c(m, pSelfCtx, pUnit)
      const pSelfList = m.u32((pDesc + 0x44) >>> 0) >>> 0
      if (pSelfList !== 0 && curMana256 > manaCost256 && wClearState <= 0) {
        for (let i = 0; i < 5; i++) {
          const pStatId = sx16(m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0))
          const pCalc = m.u32((pSkillsTxt + 0xa4 + i * 4) >>> 0)
          const pVal = SKILLS_EvalCalcByOffset113c(m, pUnit, pCalc, skillId, nSkillLevel) | 0
          if (pVal !== 0 && pStatId > 0 && pStatId < nItemStatCount) {
            STATLIST_SetStat113c(m, pSelfList, pStatId, pVal, 0)
          }
        }
      }
    }

    const targetAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
    if (targetAuraState >= 0 && targetAuraState < nStatesCount) {
      m.setU32(pDesc, targetAuraState >>> 0)
      const nRadius = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x64) >>> 0),
        skillId,
        nSkillLevel,
      )
      const dwFilterFlags = m.u32((pSkillsTxt + 0x50) >>> 0)
      AURA_ForEachUnitInRadius113c(
        m,
        pGame,
        pUnit,
        0,
        0,
        nRadius,
        dwFilterFlags,
        RADIAL_AURA_BUFF_CALLBACK_VA_113C,
        pDesc,
        1,
      )

      if (manaCost256 > 0 && pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 0) {
        const appliedCount = m.u32((pDesc + 0x40) >>> 0) | 0
        if (appliedCount > 0) {
          STATES_ToggleGfxStateFlag113c(m, pUnit, 0x55, 1)
          deductPlayerAuraManaOrBloodMana(m, manaCost256, pUnit)
          return 1
        }
        STATES_ToggleGfxStateFlag113c(m, pUnit, 0x55, 0)
      }
    }
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * Looks up `D2GAME_ITEM_EVENT_CALLBACK_TABLE_113C[nItemEventId]` (`0..49`) and registers a
 * `D2UnitEventStrc` node on `pUnit` when non-null.
 *
 * @va D2Game:0x6FCBE290
 */
export function ITEMS_RegisterItemEventCallback113c(
  m: Memory113c,
  nItemEventId: number,
  dwGuid: number,
  nFuncType: number,
  pUnit: number,
  pGame: number,
  nEventType: number,
  dwArg1: number,
  dwArg2: number,
): number {
  const idx = nItemEventId | 0
  if (idx < 0 || idx >= 0x32) return 0
  const pfnCallback = D2GAME_ITEM_EVENT_CALLBACK_TABLE_113C[idx]! >>> 0
  if (pfnCallback === 0) return 0
  return UNITEVENT_RegisterTimerOrItemEventNode113c(
    m,
    pUnit,
    pGame,
    nEventType,
    dwArg1,
    dwArg2,
    pfnCallback,
    nFuncType,
    dwGuid,
  )
}

/**
 * Axis-aligned bounding-box intersection check between circle `(nX, nY, nRadius)` and `pRoom`'s
 * subtile rectangle (`DUNGEON_GetRoomCoordinates`).
 *
 * @va D2Game:0x6FCBE610
 */
export function AURA_CheckCircleIntersectsRoom113c(
  m: Memory113c,
  nY: number,
  pRoom: number,
  nX: number,
  nRadius: number,
): number {
  if (pRoom === 0) return 0
  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x20) >>> 0
  try {
    m.fill(sp, 0x20, 0)
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    const rx = m.u32(sp) | 0
    const ry = m.u32((sp + 0x04) >>> 0) | 0
    const rw = m.u32((sp + 0x08) >>> 0) | 0
    const rh = m.u32((sp + 0x0c) >>> 0) | 0
    const cx = nX | 0
    const cy = nY | 0
    const rad = nRadius | 0

    if (((cx + rad) | 0) >= rx) {
      if (((cy + rad) | 0) >= ry) return 1
      return ((cy - rad) | 0) <= ((ry + rh) | 0) ? 1 : 0
    }
    if (((cx - rad) | 0) > ((rx + rw) | 0)) return 0
    if (((cy + rad) | 0) >= ry) return 1
    return ((cy - rad) | 0) <= ((ry + rh) | 0) ? 1 : 0
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * Adds elemental/special damage (`eElemType` `0..12`, including random element `10`) into
 * `pDmg` (`D2DamageStrc`) and optionally writes `outResStat` (`37/39/41/43/45/-1`) and `outActualElemType`.
 *
 * @va D2Game:0x6FCBEFE0
 */
export function SUNITDMG_AddElementalDamageToStruct113c(
  m: Memory113c,
  pDmg: number,
  eElemType: number,
  pAttacker: number,
  nDamage256: number,
  nLength: number,
  pOutResStat: number,
  pOutActualElemType: number,
): void {
  if (pDmg === 0) return
  let elemType = eElemType | 0
  let len = nLength | 0
  const dmg = nDamage256 | 0

  if (elemType === 10 && pAttacker !== 0) {
    const pSeed = (pAttacker + 0x20) >>> 0
    const lo = m.u32(pSeed) >>> 0
    const hi = m.u32((pSeed + 4) >>> 0) >>> 0
    const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
    const newLo = Number(prod & 0xffffffffn) >>> 0
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32(pSeed, newLo)
    m.setU32((pSeed + 4) >>> 0, newHi)
    elemType = RANDOM_ELEM_TYPES_TABLE_113C[newLo & 3]!
    if (len <= 0) len = 0x32
    if (pOutActualElemType !== 0) {
      m.setU32(pOutActualElemType >>> 0, elemType >>> 0)
    }
  }

  let resStat = -1
  switch (elemType) {
    case 1:
      m.setU32((pDmg + 0x10) >>> 0, ((m.u32((pDmg + 0x10) >>> 0) | 0) + dmg) >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x20)
      resStat = 0x27
      break
    case 2:
      m.setU32((pDmg + 0x1c) >>> 0, ((m.u32((pDmg + 0x1c) >>> 0) | 0) + dmg) >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x40)
      resStat = 0x29
      break
    case 3:
      m.setU32((pDmg + 0x20) >>> 0, ((m.u32((pDmg + 0x20) >>> 0) | 0) + dmg) >>> 0)
      resStat = 0x25
      break
    case 4:
      m.setU32((pDmg + 0x24) >>> 0, ((m.u32((pDmg + 0x24) >>> 0) | 0) + dmg) >>> 0)
      m.setU32((pDmg + 0x30) >>> 0, len >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x30)
      resStat = 0x2b
      break
    case 5:
      m.setU32((pDmg + 0x28) >>> 0, ((m.u32((pDmg + 0x28) >>> 0) | 0) + dmg) >>> 0)
      m.setU32((pDmg + 0x2c) >>> 0, len >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x50)
      resStat = 0x2d
      break
    case 6:
      m.setU32((pDmg + 0x38) >>> 0, ((m.u32((pDmg + 0x38) >>> 0) | 0) + dmg) >>> 0)
      break
    case 7:
      m.setU32((pDmg + 0x3c) >>> 0, ((m.u32((pDmg + 0x3c) >>> 0) | 0) + dmg) >>> 0)
      break
    case 8:
      m.setU32((pDmg + 0x40) >>> 0, ((m.u32((pDmg + 0x40) >>> 0) | 0) + dmg) >>> 0)
      break
    case 9:
      m.setU32((pDmg + 0x44) >>> 0, ((m.u32((pDmg + 0x44) >>> 0) | 0) + dmg + len) >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x60)
      break
    case 11:
      m.setU32((pDmg + 0x14) >>> 0, ((m.u32((pDmg + 0x14) >>> 0) | 0) + dmg) >>> 0)
      m.setU32((pDmg + 0x18) >>> 0, len >>> 0)
      break
    case 12:
      m.setU32((pDmg + 0x24) >>> 0, ((m.u32((pDmg + 0x24) >>> 0) | 0) + dmg) >>> 0)
      m.setU32((pDmg + 0x34) >>> 0, len >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x30)
      resStat = 0x2b
      break
    default:
      m.setU32((pDmg + 0x08) >>> 0, ((m.u32((pDmg + 0x08) >>> 0) | 0) + dmg) >>> 0)
      break
  }

  if (pOutResStat !== 0) {
    m.setU32(pOutResStat >>> 0, resStat >>> 0)
  }
}

/**
 * Creates, refreshes, or replaces a state/curse/aura `D2StatListStrc` on `pAuraSetup->pTargetUnit`
 * (`+0x04`), respecting monster boss/corpse flags, `STAT_CURSE_RESISTANCE` (`0x6D`), `Attract` (`0x39`),
 * skill-level precedence, and timer event `0x0C` expiration.
 *
 * @va D2Game:0x6FCC00B0
 */
export function STATES_CreateOrUpdateAuraStatList113c(
  m: Memory113c,
  pAuraSetup: number,
): number {
  if (pAuraSetup === 0) return 0
  const pTarget = m.u32((pAuraSetup + 0x04) >>> 0) >>> 0
  if (pTarget === 0) {
    throw new Error('STATES_CreateOrUpdateAuraStatList113c: pTarget == NULL (line 2602)')
  }

  const pGame = m.u32((pTarget + 0x80) >>> 0) >>> 0
  const stateId = m.u32((pAuraSetup + 0x1c) >>> 0) | 0
  if (stateId < 0) return 0

  const pTables = readSgptDataTables(m)
  if (pTables === 0) return 0
  const nStates = m.u32((pTables + 0xc4) >>> 0) | 0
  if (stateId >= nStates) return 0
  const pStatesBase = m.u32((pTables + 0xbc) >>> 0) >>> 0
  if (pStatesBase === 0) return 0
  const pStateTxt = (pStatesBase + Math.imul(stateId, 0x3c)) >>> 0

  if ((m.u32(pTarget >>> 0) | 0) === 1) {
    const classId = m.u32((pTarget + 0x04) >>> 0) | 0
    if (classId < 0 || classId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
    const pMonBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
    if (pMonBase === 0) return 0
    const pMonStats = (pMonBase + Math.imul(classId, 0x1a8)) >>> 0
    if ((m.u8((pMonStats + 0x0d) >>> 0) & readGdwBitMaskByte(m, 0x00)) !== 0) return 0
    const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, classId)
    if (pMonStats2 === 0) return 0
    if ((m.u8((pMonStats2 + 0x05) >>> 0) & readGdwBitMaskByte(m, 0x04)) === 0) return 0
  }

  const isCurseMask = UNITS_CheckStateMaskAura113c(m, stateId)
  if (isCurseMask !== 0) {
    const curseRes = STATLIST_GetUnitStat113c(m, pTarget, 0x6d, 0) | 0
    if (curseRes >= 100) return 0
    if (curseRes !== 0) {
      const curDur = m.u32((pAuraSetup + 0x10) >>> 0) | 0
      const red = mulDiv113c(curseRes, curDur, 100) | 0
      m.setU32((pAuraSetup + 0x10) >>> 0, ((curDur - red) | 0) >>> 0)
    }
    if (STATES_CheckState113c(m, pTarget, 0x39) !== 0) return 0
  }

  let listFlags = 0
  let pExisting = 0
  if (isCurseMask !== 0) {
    listFlags = 0x20
    pExisting = STATLIST_GetStatListFromUnitAndFlag113c(m, pTarget, 0x20)
  } else {
    pExisting = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTarget, stateId)
  }

  const newSkillId = m.u32((pAuraSetup + 0x08) >>> 0) | 0
  const newSkillLvl = m.u32((pAuraSetup + 0x0c) >>> 0) | 0

  if (pExisting !== 0) {
    const exState = STATLIST_GetState113c(m, pExisting) | 0
    const exSkill = STATLIST_GetSkillId113c(m, pExisting) | 0
    if (exState === stateId && exSkill === newSkillId) {
      const exLvl = STATLIST_GetSkillLevel113c(m, pExisting) | 0
      if (newSkillLvl === exLvl) {
        const dur = m.u32((pAuraSetup + 0x10) >>> 0) | 0
        if (dur !== 0 && pGame !== 0) {
          const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + dur) | 0
          STATLIST_SetExpireFrame113c(m, pExisting, expireFrame)
          EVENT_SetEventFull113c(m, pGame, pTarget, 0x0c, expireFrame, 0, 0, 0)
        }
        return pExisting
      }
      if (newSkillLvl < exLvl) {
        return 0
      }
    }
    STATLIST_UnlinkSubList113c(m, pTarget, pExisting)
    STATLIST_FreeStatListIfNonExtended113c(m, pExisting)
  }

  UNITROOM_RefreshUnit113c(m, pTarget)
  STATES_ToggleGfxStateFlag113c(m, pTarget, stateId, 1)

  const dur = m.u32((pAuraSetup + 0x10) >>> 0) | 0
  let expireFrame = 0
  if (dur !== 0 && pGame !== 0) {
    expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + dur) | 0
    listFlags |= 0x02
    EVENT_SetEventFull113c(m, pGame, pTarget, 0x0c, expireFrame, 0, 0, 0)
  }

  if (UNITS_CheckStateMaskOnCurse113c(m, stateId) !== 0) {
    listFlags |= 0x800
  }
  if ((m.u8((pStateTxt + 0x10) >>> 0) & readGdwBitMaskByte(m, 0x04)) !== 0) {
    listFlags |= 0x08
  }

  const pSource = m.u32(pAuraSetup >>> 0) >>> 0
  const ownerType = pSource !== 0 ? (m.u32(pSource) | 0) : 6
  const ownerId = pSource !== 0 ? (m.u32((pSource + 0x0c) >>> 0) >>> 0) : 0xffffffff

  const pNewList = STATLIST_AllocList113c(
    m,
    listFlags >>> 0,
    ownerType,
    ownerId,
    0,
    expireFrame,
  )
  STATLIST_SetState113c(m, pNewList, stateId)
  STATLIST_SetSkillId113c(m, pNewList, newSkillId)
  STATLIST_SetSkillLevel113c(m, pNewList, newSkillLvl)

  const initStatId = m.u32((pAuraSetup + 0x14) >>> 0) | 0
  if (initStatId !== -1) {
    const initStatVal = m.u32((pAuraSetup + 0x18) >>> 0) | 0
    STATLIST_SetStat113c(m, pNewList, initStatId, initStatVal, 0)
  }

  STATLIST_MergeStatLists113c(m, pTarget, pNewList, 1)
  const customRemove = m.u32((pAuraSetup + 0x20) >>> 0) >>> 0
  STATLIST_SetStatRemoveProc113c(
    m,
    pNewList,
    customRemove !== 0 ? customRemove : DEFAULT_AURA_REMOVE_PROC_VA_113C,
  )
  return pNewList
}

/**
 * Evaluates 20-bit `Skills.txt` `AuraFilter` flags (`dwFilterFlags`) against `(pSourceUnit, pTargetUnit)`:
 * unit types (`0..4`), alive/corpse mode (`0x1000`), undead/demon (`0x04`), boss exclusion (`0x4000`),
 * interactable (`0x40000`), missile pierce (`0x08`), attackable/targetable unit flags (`0x80`/`0x400`),
 * town exclusion (`0x100`), party/alignment (`0x10000`), hostility (`0x8000`), melee reach (`0x20000`),
 * `STATE_IGNORE_PET`/`0x56` (`0x80000`), and LOS raytrace (`0x200`).
 *
 * @va D2Game:0x6FCC0370
 */
export function AURA_CheckUnitMatchesFilterFlags113c(
  m: Memory113c,
  dwFilterFlags: number,
  pSourceUnit: number,
  pTargetUnit: number,
): number {
  if (pTargetUnit === 0) return 0
  const flags = dwFilterFlags >>> 0
  let pSource = pSourceUnit >>> 0
  const targetType = m.u32(pTargetUnit >>> 0) >>> 0
  if (targetType > 4) return 0

  switch (targetType) {
    case 0: {
      if ((flags & 0x01) === 0) return 0
      const mode = m.u32((pTargetUnit + 0x10) >>> 0) | 0
      if ((flags & 0x1000) !== 0) {
        if (mode !== 0x11) return 0
      } else {
        if (mode === 0x11) return 0
        if (mode === 0) return 0
      }
      break
    }
    case 1: {
      if ((flags & 0x02) === 0) return 0
      const mode = m.u32((pTargetUnit + 0x10) >>> 0) | 0
      if ((flags & 0x1000) !== 0) {
        if (mode !== 0x0c) return 0
      } else {
        if (mode === 0x0c || mode === 0) return 0
      }
      if ((flags & 0x04) !== 0 && MONSTERS_IsDemonOrUndead113c(m, pTargetUnit) === 0) {
        return 0
      }
      if ((flags & 0x4000) !== 0 && MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pTargetUnit) !== 0) {
        return 0
      }
      if ((flags & 0x40000) !== 0 && MONSTER_GetMonStatsInteractBit113c(m, pTargetUnit) !== 0) {
        return 0
      }
      break
    }
    case 2:
      if ((flags & 0x10) === 0) return 0
      break
    case 3: {
      if ((flags & 0x08) === 0) return 0
      const missileId = m.u32((pTargetUnit + 0x04) >>> 0) | 0
      const pMissilesTxt = getMissilesTxtRecordFast(m, missileId)
      if (pMissilesTxt === 0) return 0
      if ((m.u8((pMissilesTxt + 0x04) >>> 0) & readGdwBitMaskByte(m, 0x04)) !== 0) return 0
      break
    }
    case 4:
      if ((flags & 0x20) === 0) return 0
      break
    default:
      return 0
  }

  if ((flags & 0x80) !== 0) {
    if (((m.u32((pTargetUnit + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0
  }
  if ((flags & 0x400) !== 0) {
    if (((m.u32((pTargetUnit + 0xc4) >>> 0) >>> 3) & 1) === 0) return 0
  }
  if ((flags & 0x100) !== 0) {
    const pRoom = UNITS_GetRoom113c(m, pTargetUnit)
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0
  }

  if ((flags & 0x10000) !== 0) {
    if (pSource !== 0 && (m.u32(pSource) | 0) === 3) {
      const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pSource)
      pSource = resolveMissileOwnerUnit(m, pSource, pGame)
      if (pSource === 0) return 0
    }
    D2GAME_SUNIT_GetGameFromUnit113c(m, pSource)
    if (SUNIT_AreUnitsInSamePartyOrAligned113c(m, pTargetUnit, pSource) === 0) return 0
    if ((m.u32(pTargetUnit >>> 0) | 0) === 1) {
      const pMonStats = MONSTATS_GetRecordPtr113c(m, m.u32((pTargetUnit + 0x04) >>> 0) | 0)
      if (pMonStats === 0) return 0
      if ((m.u8((pMonStats + 0x0d) >>> 0) & readGdwBitMaskByte(m, 0x00)) !== 0) return 0
    }
  }

  if ((flags & 0x8000) !== 0) {
    if (pSource !== 0 && (m.u32(pSource) | 0) === 3) {
      const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pSource)
      pSource = resolveMissileOwnerUnit(m, pSource, pGame)
      if (pSource === 0) return 0
    }
    const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pSource)
    if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pSource, pTargetUnit, pGame) === 0) return 0
  }

  if ((flags & 0x20000) !== 0) {
    if (pSource !== 0 && (m.u32(pSource) | 0) === 3) {
      const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pSource)
      pSource = resolveMissileOwnerUnit(m, pSource, pGame)
      if (pSource === 0) return 0
    }
    if (UNITS_CanUnitMeleeAttackTarget113c(m, pSource, pTargetUnit, 0) === 0) return 0
  }

  if ((flags & 0x80000) !== 0) {
    if (STATES_CheckState113c(m, pTargetUnit, 0x56) !== 0) return 0
  }

  if ((flags & 0x200) !== 0) {
    const pSrcRoom = UNITS_GetRoom113c(m, pSource)
    if (pSrcRoom === 0) return 0
    const pDstRoom = UNITS_GetRoom113c(m, pTargetUnit)
    if (pDstRoom === 0) return 0

    const sp = itemdefGapStackPtr
    itemdefGapStackPtr = (sp + 0x10) >>> 0
    try {
      m.setU32(sp, UNIT_GetPosX113c(m, pTargetUnit) >>> 0)
      m.setU32((sp + 0x04) >>> 0, UNIT_GetPosY113c(m, pTargetUnit) >>> 0)
      m.setU32((sp + 0x08) >>> 0, UNIT_GetPosX113c(m, pSource) >>> 0)
      m.setU32((sp + 0x0c) >>> 0, UNIT_GetPosY113c(m, pSource) >>> 0)
      if (COLLISION_RayTrace113c(m, pSrcRoom, (sp + 0x08) >>> 0, sp, 4) !== 0) {
        return 0
      }
    } finally {
      itemdefGapStackPtr = sp
    }
  }

  return 1
}

/**
 * Iterates all units in adjacent rooms within circle `(nX, nY, nRadius)` around `pCenterUnit`,
 * filters them via `AURA_CheckUnitMatchesFilterFlags113c`, and dispatches `pfnCallback`
 * (`0x6FC62EC0`, `0x6FCBA1A0`, or `customCallback`).
 *
 * @va D2Game:0x6FCC0C70
 */
export function AURA_ForEachUnitInRadius113c(
  m: Memory113c,
  pGame: number,
  pCenterUnit: number,
  nX: number,
  nY: number,
  nRadius: number,
  dwFilterFlags: number,
  pfnCallback: number,
  pCallbackArg: number,
  bSkipMonFlag1B: number,
  customCallback?: AuraRadiusUnitCallback113c,
): void {
  if (pGame === 0 || pCenterUnit === 0 || pfnCallback === 0) return
  const rad = nRadius | 0
  if (rad <= 0) return
  const pCenterRoom = UNITS_GetRoom113c(m, pCenterUnit)
  if (pCenterRoom === 0) return

  let cx = nX | 0
  let cy = nY | 0
  if (cx === 0 || cy === 0) {
    cx = UNIT_GetPosX113c(m, pCenterUnit) | 0
    cy = UNIT_GetPosY113c(m, pCenterUnit) | 0
  }

  let flags = dwFilterFlags >>> 0
  if (flags === 0) flags = 0x583
  const radSq = Math.imul(rad, rad) | 0

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x20) >>> 0
  const ppRooms = sp
  const pRoomCount = (sp + 0x04) >>> 0
  const pAuraCtx = (sp + 0x08) >>> 0
  try {
    m.setU32(ppRooms, 0)
    m.setU32(pRoomCount, 0)
    m.setU32(pAuraCtx, pGame >>> 0)
    m.setU32((pAuraCtx + 0x04) >>> 0, pCenterUnit >>> 0)
    m.setU32((pAuraCtx + 0x08) >>> 0, 0)
    m.setU32((pAuraCtx + 0x0c) >>> 0, pCallbackArg >>> 0)

    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pCenterRoom, ppRooms, pRoomCount)
    const count = m.u32(pRoomCount) >>> 0
    if (count === 0) return
    const pList = m.u32(ppRooms) >>> 0
    const skipTown = (flags & 0x2000) !== 0

    for (let rIdx = 0; rIdx < count; rIdx++) {
      const pRoom = m.u32((pList + rIdx * 4) >>> 0) >>> 0
      if (pRoom === 0) continue
      if (skipTown && DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
        continue
      }
      if (AURA_CheckCircleIntersectsRoom113c(m, cy, pRoom, cx, rad) === 0) {
        continue
      }

      let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
      while (pUnit !== 0) {
        const pNext = m.u32((pUnit + 0xe8) >>> 0) >>> 0
        if (pUnit !== (pCenterUnit >>> 0)) {
          const ux = UNIT_GetPosX113c(m, pUnit) | 0
          const uy = UNIT_GetPosY113c(m, pUnit) | 0
          const distSq = PATH_ComputeSquaredDistance113c(cx, cy, ux, uy) | 0
          if (
            radSq >= distSq &&
            AURA_CheckUnitMatchesFilterFlags113c(m, flags, pCenterUnit, pUnit) !== 0
          ) {
            let skipBoss = false
            if (bSkipMonFlag1B !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
              const classId = m.u32((pUnit + 0x04) >>> 0) | 0
              if (MONSTATS_CheckFlagBit113c(m, classId, 0x1b) !== 0) {
                skipBoss = true
              }
            }
            if (!skipBoss) {
              let cbRes = 0
              if ((pfnCallback >>> 0) === STATIC_FIELD_CALLBACK_VA_113C) {
                cbRes = SKILLS_CallbackStaticField113c(m, pAuraCtx, pUnit)
              } else if ((pfnCallback >>> 0) === RADIAL_AURA_BUFF_CALLBACK_VA_113C) {
                cbRes = AURAS_ApplyRadialStatBuffCallback113c(m, pAuraCtx, pUnit)
              } else if (customCallback !== undefined) {
                cbRes = customCallback(m, pAuraCtx, pUnit)
              }
              if (cbRes !== 0) {
                m.setU32(
                  (pAuraCtx + 0x08) >>> 0,
                  ((m.u32((pAuraCtx + 0x08) >>> 0) | 0) + 1) >>> 0,
                )
              }
            }
          }
        }
        pUnit = pNext
      }
    }
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * Activates an aura skill (`nSkillId`) on `pUnit`, executing immediately if `immediate` flag
 * (`Skills.txt + 0x05` bit 7) is set, or creating/updating its aura state statlist and scheduling
 * periodic aura timer event `8`.
 *
 * @va D2Game:0x6FCC1D10
 */
export function SKILLS_ActivateAuraSkillOnUnit113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
): void {
  const skillId = nSkillId | 0
  if (skillId < 0) return
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return
  if ((m.u8((pSkillsTxt + 0x04) >>> 0) & readGdwBitMaskByte(m, 0x14)) === 0) return

  const auraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  const pTables = readSgptDataTables(m)
  if (pTables === 0) return
  if (auraState < 0 || auraState >= (m.u32((pTables + 0xc4) >>> 0) | 0)) return

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, skillId)
  if (pSkill === 0) return
  const skillLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0
  if (skillLvl <= 0) return

  if ((m.u8((pSkillsTxt + 0x05) >>> 0) & readGdwBitMaskByte(m, 0x1c)) !== 0) {
    SKILLS_ExecuteSkillDoFunc113c(m, pUnit, pGame, skillId, skillLvl, 1, 0, 0)
    SKILLS_SetSkillDelayTimer113c(m, skillId, pGame, pUnit, skillLvl, 1)
    return
  }

  STATES_ToggleGfxStateFlag113c(m, pUnit, auraState, 1)
  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, auraState)
  if (pStatList === 0) {
    const ownerType = pUnit !== 0 ? (m.u32(pUnit >>> 0) | 0) : 6
    const ownerId = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    pStatList = STATLIST_AllocList113c(m, 0, ownerType, ownerId, 0, 0)
  }
  if (pStatList !== 0) {
    STATLIST_SetState113c(m, pStatList, auraState)
    STATLIST_SetSkillId113c(m, pStatList, skillId)
    STATLIST_SetSkillLevel113c(m, pStatList, skillLvl)
    STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1)
    STATLIST_SetStat113c(m, pStatList, 0x15e, skillId, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15f, skillLvl, 0)
  }
  SKILLS_SetSkillDelayTimer113c(m, skillId, pGame, pUnit, skillLvl, 1)
}

/**
 * Timer event `8` (`EVENT_AURAPULSE`) handler for right-hand active aura (`nAuraSkillId == -1`)
 * and item/passive-granted aura skills (`nAuraSkillId > 0`).
 *
 * @va D2Game:0x6FCC1E80
 */
export function SKILLS_Event08_AuraPulseTick113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nAuraSkillId: number,
  _arg18 = 0,
): void {
  void _arg18
  const argSkillId = nAuraSkillId | 0

  if (argSkillId === -1) {
    const pRightSkill = UNITS_GetRightSkill113c(m, pUnit)
    if (pRightSkill !== 0) {
      const skillId = SKILLS_GetSkillIdFromSkill113c(m, pRightSkill, 0, 0) | 0
      const skillLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pRightSkill, 1) | 0
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
      if (
        pSkillsTxt !== 0 &&
        (m.u8((pSkillsTxt + 0x04) >>> 0) & readGdwBitMaskByte(m, 0x14)) !== 0 &&
        SUNIT_IsDeadOrDying113c(m, pUnit) === 0
      ) {
        SKILLS_ExecuteSkillDoFunc113c(m, pUnit, pGame, skillId, skillLvl, 1, 0, 0)
        SKILLS_SetSkillDelayTimer113c(m, skillId, pGame, pUnit, skillLvl, 1)
        return
      }
    }
    if (pUnit === 0) return
    let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEv !== 0) {
      const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
      if (m.u8(pEv) === 8 && (m.u32((pEv + 0x14) >>> 0) | 0) === -1) {
        EVENT_FreeNode113c(m, pGame, pEv)
      }
      pEv = pNext
    }
    return
  }

  if (argSkillId <= 0) return
  const pTables = readSgptDataTables(m)
  if (pTables === 0) return
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, argSkillId)
  if (pSkillsTxt !== 0) {
    const auraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
    const nStates = m.u32((pTables + 0xc4) >>> 0) | 0
    if (auraState >= 0 && auraState < nStates && STATES_CheckState113c(m, pUnit, auraState) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, auraState)
      if (pStatList !== 0) {
        const storedLvl = STATLIST_GetStatValue113c(m, pStatList, 0x15f, 0) | 0
        const pUnitSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
          m,
          pUnit,
          argSkillId,
        )
        if (pUnitSkill !== 0) {
          const storedSkillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0
          if (storedSkillId === argSkillId) {
            SKILLS_ExecuteSkillDoFunc113c(m, pUnit, pGame, argSkillId, storedLvl, 1, 0, 0)
            SKILLS_SetSkillDelayTimer113c(m, argSkillId, pGame, pUnit, storedLvl, 0)
            return
          }
        }
        EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 8, argSkillId)
        return
      }
    }
  }
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 8, argSkillId)
}

/**
 * Item Event #13 (`ITEMEVENT_ManaAfterKill` / `+Mana After Each Kill`, `STAT_ITEM_MANAAFTERKILL`
 * / `STAT_ITEM_DAMAGETOMANA` style scaled or flat callback in `D2Game.dll` `0x6FCCCDA0`):
 * restores mana to player `pUnit` based on `mulDiv(statVal, pDmg->dwDmgTotal, 100)` (Damage Taken Goes To Mana!)
 * and triggers overlay `0x98`.
 *
 * @va D2Game:0x6FCCCDA0
 */
export function ITEMEVENT_ManaAfterKill113c(
  m: Memory113c,
  pUnit: number,
  _pTarget: number,
  pDmg: number,
  dwStatAndLayer: number,
  _dwArg2 = 0,
): number {
  void _pTarget
  void _dwArg2
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 0) return 0
  if (pDmg === 0) return 0
  const dmgTotal = m.u32((pDmg + 0x4c) >>> 0) | 0
  if (dmgTotal <= 0) return 0

  const statId = (dwStatAndLayer >>> 16) & 0xffff
  const layer = dwStatAndLayer & 0xffff
  const pct = STATLIST_GetUnitStatWithLayer113c(m, pUnit, statId, layer) | 0
  if (pct <= 0) return 0

  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, pUnit) | 0
  const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0
  if (curMana >= maxMana) return 0

  const gain = mulDiv113c(pct, dmgTotal, 100) | 0
  let nextMana = (curMana + gain) | 0
  if (nextMana <= 0) nextMana = 0
  if (nextMana >= maxMana) nextMana = maxMana

  STATLIST_SetUnitStat113c(m, pUnit, 8, nextMana, 0)
  STATES_SetMonsterSkillIconOnUnit113c(m, pUnit, 0x98, 0)
  return 1
}

/**
 * Item Event #6 (`Attacker Takes Damage of X`): deals `(statVal << 8)` physical thorns damage
 * from `pUnit` back to `pAttacker` when `pAttacker` is attackable (`dwFlags & 0x04`).
 *
 * @va D2Game:0x6FCCD910
 */
export function ITEMEVENT_AttackerTakesDamage113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAttacker: number,
  _pDmg: number,
  dwStatAndLayer: number,
  _dwArg2 = 0,
): number {
  void _pDmg
  void _dwArg2
  if (pUnit === 0 || pAttacker === 0) return 0
  if (((m.u32((pAttacker + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0

  const statId = (dwStatAndLayer >>> 16) & 0xffff
  const layer = dwStatAndLayer & 0xffff
  const thornsVal = STATLIST_GetUnitStatWithLayer113c(m, pUnit, statId, layer) | 0
  if (thornsVal <= 0) return 0

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x70) >>> 0
  try {
    m.fill(sp, 0x70, 0)
    m.setU16((sp + 0x04) >>> 0, 0x4021)
    m.setU32((sp + 0x08) >>> 0, (thornsVal << 8) >>> 0)
    m.setU32((sp + 0x60) >>> 0, 0x8d)

    SUNITDMG_ApplyDamage113c(m, pGame, pUnit, pAttacker, sp)
    applyPostDamageHitReaction(m, pGame, pUnit, pAttacker, sp)
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}

/**
 * Item Event #21 (`Chance to Cast Skill on Striking / Attacked / Kill`): decodes `(skillId, slvl)`
 * from `dwStatAndLayer & 0xFFFF` using `sgptDataTables + 0xC6C / +0xC70`, rolls `chance%` on
 * `pUnit->tSeed`, and triggers the skill on `pTarget` (or caster's path coordinates when `pTarget == 0`).
 *
 * @va D2Game:0x6FCCDCE0
 */
export function ITEMEVENT_ChanceToCastSkill113c(
  m: Memory113c,
  pUnit: number,
  pTarget: number,
  pDmg: number,
  dwStatAndLayer: number,
  _dwArg2 = 0,
): number {
  void _dwArg2
  if (pUnit === 0) return 0
  const statId = (dwStatAndLayer >>> 16) & 0xffff
  const layer = dwStatAndLayer & 0xffff
  const chancePct = STATLIST_GetUnitStatWithLayer113c(m, pUnit, statId, layer) | 0
  if (chancePct <= 0) return 0

  const pTables = readSgptDataTables(m)
  if (pTables === 0) return 0
  const paramShift = m.u32((pTables + 0xc6c) >>> 0) & 31
  const paramMask = m.u32((pTables + 0xc70) >>> 0)
  const skillId = layer >> paramShift
  const skillLvl = (layer & paramMask) | 0

  if (pDmg === 0 || (m.u8((pDmg + 0x04) >>> 0) & 0x04) === 0) {
    return 0
  }
  const roll = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, 100) | 0
  if (roll >= chancePct) return 0
  if (SKILLS_GetRecordPtrFast113c(m, skillId) === 0) return 0

  if (pTarget === 0) {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    const targetY = PATH_GetFirstPointY113c(m, pPath) | 0
    const targetX = PATH_GetFirstPointX113c(m, pPath) | 0
    triggerSkillAtCoords(m, pUnit, targetY, skillId, skillLvl, targetX, 0)
    return 1
  }

  SKILLS_TriggerSkillOnTarget113c(m, pTarget, pUnit, skillId, skillLvl, 0)
  return 1
}

/**
 * Writes `dwValue` into `pUnit->pMonsterData + 0x54` when `pUnit` is a monster (`dwUnitType == 1`).
 *
 * @va D2Game:0x6FCCF710
 */
export function MONSTER_SetLastHitModeField54_113c(
  m: Memory113c,
  pUnit: number,
  dwValue: number,
): void {
  if (pUnit === 0) return
  if ((m.u32(pUnit >>> 0) | 0) !== 1) return
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return
  m.setU32((pMonsterData + 0x54) >>> 0, dwValue >>> 0)
}

/**
 * Resolves the scroll (`ITYPE_SCROLL = 0x16` -> `+0x08`) or tome (`ITYPE_TOME = 0x12` -> `+0x0C`)
 * skill ID from `Book.txt` (`DATATBLS_GetQualityItemsTxtRecord(ITEMS_GetMagicSuffix(pItem, 0))`),
 * returning `-1` if `pItem` is neither a scroll nor a tome.
 *
 * @va D2Game:0x6FCF1AA0
 */
export function ITEMS_GetScrollOrTomeSkillId113c(
  m: Memory113c,
  pItem: number,
): number {
  if (pItem === 0) {
    throw new Error('ITEMS_GetScrollOrTomeSkillId113c: pItem == NULL (line 493)')
  }
  const isScroll = ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x16)
  if (isScroll === 0 && ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x12) === 0) {
    return -1
  }
  const bookIdx = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff
  const pBookRec = DATATBLS_GetQualityItemsTxtRecord113c(m, bookIdx)
  if (pBookRec === 0) return -1
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x16) !== 0) {
    return m.u32((pBookRec + 0x08) >>> 0) | 0
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x12) !== 0) {
    return m.u32((pBookRec + 0x0c) >>> 0) | 0
  }
  return -1
}

/**
 * Adds (`bEquip != 0`) or removes (`bEquip == 0`) scroll/tome skill charges (`STAT_QUANTITY = 0x46`)
 * on `pUnit`, syncing `0x22` charge count and resetting hand skill to Attack (`0`) if depleted.
 *
 * @va D2Game:0x6FCF43E0
 */
export function ITEMS_UpdateScrollOrTomeSkillCharges113c(
  m: Memory113c,
  pItem: number,
  pUnit: number,
  bEquip: number,
): number {
  const skillId = ITEMS_GetScrollOrTomeSkillId113c(m, pItem) | 0
  if (skillId === -1) return 0

  let qty = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0
  if (qty === 0) {
    if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x12) !== 0) {
      return 0
    }
    qty = 1
  }

  let pSkill = SKILLS_GetSkillById113c(m, pUnit, skillId, -1)
  let newCharges = 0

  if (bEquip !== 0) {
    if (pSkill === 0) {
      newCharges = qty
      STATLIST_AddUnitStatMemPort113c(m, pUnit, 5, qty, 0)
      learnSkillFromPointsOrScroll(m, skillId, pUnit)
      pSkill = SKILLS_GetSkillById113c(m, pUnit, skillId, -1)
      if (pSkill === 0) {
        throw new Error('ITEMS_UpdateScrollOrTomeSkillCharges113c: pSkill == NULL after add (line 550)')
      }
    } else {
      newCharges = (SKILLS_GetCharges113c(m, pSkill) + qty) | 0
    }
  } else {
    if (pSkill === 0) {
      throw new Error('ITEMS_UpdateScrollOrTomeSkillCharges113c: pSkill == NULL on unequip (line 561)')
    }
    newCharges = (SKILLS_GetCharges113c(m, pSkill) - qty) | 0
    if (newCharges < 0) newCharges = 0
  }

  SKILLS_SetCharges113c(m, pSkill, newCharges)

  let unitType = 6
  let unitId = 0xffffffff
  let pClient = 0
  if (pUnit !== 0) {
    unitId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
    unitType = m.u32(pUnit >>> 0) | 0
    if (unitType === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
      if (pPlayerData !== 0) {
        pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
      }
    }
  }

  sendPacket0x22SkillCharges(m, pClient, unitType, unitId, skillId, newCharges)

  if (newCharges === 0) {
    if (UNITS_GetLeftSkill113c(m, pUnit) === pSkill) {
      assignUnitHandSkillSlot(m, pUnit, 1, 0, -1)
    }
    if (UNITS_GetRightSkill113c(m, pUnit) === pSkill) {
      assignUnitHandSkillSlot(m, pUnit, 0, 0, -1)
    }
  }
  return 1
}

/**
 * Decrements scroll/tome skill charges when `pItem` is removed from player `pUnit` (`dwUnitType == 0`).
 *
 * @va D2Game:0x6FCF4630
 */
export function ITEMS_OnUnequipScrollOrTome113c(
  m: Memory113c,
  pItem: number,
  pUnit: number,
): void {
  if (pUnit === 0) {
    throw new Error('ITEMS_OnUnequipScrollOrTome113c: pUnit == NULL (line 917)')
  }
  if (pItem === 0) {
    throw new Error('ITEMS_OnUnequipScrollOrTome113c: pItem == NULL (line 918)')
  }
  if ((m.u32(pUnit >>> 0) | 0) === 0) {
    ITEMS_UpdateScrollOrTomeSkillCharges113c(m, pItem, pUnit, 0)
  }
}

/**
 * Increments scroll/tome skill charges when `pItem` is added to player `pUnit` (`dwUnitType == 0`).
 *
 * @va D2Game:0x6FCF4670
 */
export function ITEMS_OnEquipScrollOrTome113c(
  m: Memory113c,
  pItem: number,
  pUnit: number,
): void {
  if (pUnit === 0) {
    throw new Error('ITEMS_OnEquipScrollOrTome113c: pUnit == NULL (line 590)')
  }
  if (pItem === 0) {
    throw new Error('ITEMS_OnEquipScrollOrTome113c: pItem == NULL (line 591)')
  }
  if ((m.u32(pUnit >>> 0) | 0) === 0) {
    ITEMS_UpdateScrollOrTomeSkillCharges113c(m, pItem, pUnit, 1)
  }
}

/**
 * Deactivates an equipped item's stats, set bonuses, dual-wield weapon statlist flags,
 * scroll/tome charges, item timer event `9`, and optionally clamps pool stats.
 *
 * @va D2Game:0x6FCF46B0
 */
export function ITEMS_DeactivateEquippedItemStats113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pGame: number,
  bForceBrokenUnlink: number,
  bClampPools: number,
): void {
  if (pUnit === 0 || pItem === 0) return
  if ((m.u32(pItem >>> 0) | 0) !== 4) return
  if ((m.u32(pUnit >>> 0) | 0) === 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
    return
  }

  const itemGuid = m.u32((pItem + 0x0c) >>> 0) | 0
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 9, itemGuid)

  if ((STATLIST_GetOwnerAndDynamicFlag113c(m, pItem, 0) >>> 0) !== (pUnit >>> 0)) {
    return
  }

  if (ITEMS_GetItemQuality113c(m, pItem) === 5) {
    ITEMMODS_UpdateSetItemEquipmentState113c(m, pUnit, pItem, 1, 0)
  }

  let pCompositWeapon = 0
  if ((m.u32(pUnit >>> 0) | 0) === 0) {
    const pInv = m.u32((pUnit + 0x60) >>> 0) >>> 0
    pCompositWeapon = INVENTORY_GetCompositWeaponMemPort113c(m, pInv)
  }

  const isBroken = ITEMS_CheckCommandFlags113c(m, pItem, 0x100) !== 0
  if (!isBroken || bForceBrokenUnlink !== 0) {
    STATLIST_UnlinkUnitStatList113c(m, pUnit, pItem)
  }

  if (
    UNITS_CanDualWield113c(m, pUnit) !== 0 &&
    pCompositWeapon !== 0 &&
    ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d) !== 0 &&
    (pCompositWeapon >>> 0) !== (pItem >>> 0)
  ) {
    const otherBroken = ITEMS_CheckCommandFlags113c(m, pCompositWeapon, 0x100) !== 0
    if (
      (!otherBroken || bForceBrokenUnlink !== 0) &&
      STATLIST_GetOwnerAndDynamicFlag113c(m, pCompositWeapon, 0) !== 0
    ) {
      STATLIST_SetWeaponStatListActive113c(m, pUnit, pCompositWeapon, 1)
    }
  }

  ITEMS_OnUnequipScrollOrTome113c(m, pItem, pUnit)

  if (bClampPools !== 0) {
    STATLIST_ClampUnitPoolStatsToMax113c(m, pUnit)
  }
}

/**
 * Activates an equipped or socketed item's stats (gems `0x14`, runes `0x4A`, set bonuses,
 * scroll/tome charges, dual-wield weapon statlist activation, and unit anim mode refresh).
 *
 * @va D2Game:0x6FCF47C0
 */
export function ITEMS_ActivateEquippedItemStats113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  bActivateEvenIfBroken: number,
): void {
  if (pUnit === 0 || pItem === 0) return
  if ((m.u32(pItem >>> 0) | 0) !== 4) return
  if ((m.u32(pUnit >>> 0) | 0) === 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
    return
  }

  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x14) !== 0) {
    if ((m.u32(pUnit >>> 0) | 0) !== 4) return
    const pItemTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pItem + 0x04) >>> 0) | 0)
    if (pItemTxt === 0) return
    const pGemsTxt = DATATBLS_GetGemsTxtRecord113c(m, m.u32((pItemTxt + 0xf0) >>> 0) | 0)
    if (pGemsTxt === 0) return
    const gemApplyType = ITEMS_GetGemApplyTypeFromItem113c(m, pUnit)
    ITEMS_ApplyItemQualityMods113c(m, 2, 0, pItem, pGemsTxt, gemApplyType, 0)
  } else if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x4a) !== 0) {
    if ((m.u32(pUnit >>> 0) | 0) !== 4) return
    const pItemTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pItem + 0x04) >>> 0) | 0)
    if (pItemTxt === 0) return
    const pGemsTxt = DATATBLS_GetGemsTxtRecord113c(m, m.u32((pItemTxt + 0xf0) >>> 0) | 0)
    if (pGemsTxt === 0) return
    const gemApplyType = ITEMS_GetGemApplyTypeFromItem113c(m, pUnit)
    ITEMS_ApplyItemQualityMods113c(m, 5, pUnit, pItem, pGemsTxt, gemApplyType, 0)
  } else if (ITEMS_GetItemQuality113c(m, pItem) === 5) {
    ITEMMODS_UpdateSetItemEquipmentState113c(m, pUnit, pItem, 0, 0)
  }

  ITEMS_OnEquipScrollOrTome113c(m, pItem, pUnit)

  let pCompositWeapon = 0
  if ((m.u32(pUnit >>> 0) | 0) === 0) {
    const pInv = m.u32((pUnit + 0x60) >>> 0) >>> 0
    pCompositWeapon = INVENTORY_GetCompositWeaponMemPort113c(m, pInv)
  }

  let bActive = 1
  if (UNITS_CanDualWield113c(m, pUnit) !== 0) {
    if (
      (pItem >>> 0) !== (pCompositWeapon >>> 0) &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d) !== 0
    ) {
      bActive = 0
    }
    const isBroken = ITEMS_CheckCommandFlags113c(m, pItem, 0x100) !== 0
    if (!isBroken || bActivateEvenIfBroken !== 0) {
      STATLIST_SetWeaponStatListActive113c(m, pUnit, pItem, bActive)
    }
  } else {
    const isBroken = ITEMS_CheckCommandFlags113c(m, pItem, 0x100) !== 0
    if (!isBroken || bActivateEvenIfBroken !== 0) {
      STATLIST_SetWeaponStatListActive113c(m, pUnit, pItem, bActive)
    }
  }

  if (m.u32((pUnit + 0x2c) >>> 0) !== 0) {
    UNITS_SetUnitAnimMode113c(m, pUnit, 0, 0x2d0)
  }
}

/**
 * Resolves pet/minion owners on `pUnit2` (`eax`) and `pUnit1` (`ecx`) via `pAiGeneral` (`+0x28..+0x30`),
 * returns `1` if identical or in the same valid party (`!= 0xFFFF`), or delegates to `UNITS_AreUnitsAligned113c`.
 *
 * @va D2Game:0x6FD00570
 */
export function SUNIT_AreUnitsInSamePartyOrAligned113c(
  m: Memory113c,
  pUnit2: number,
  pUnit1: number,
): number {
  let u1 = pUnit1 >>> 0
  let u2 = pUnit2 >>> 0

  if (u1 !== 0 && (m.u32(u1) | 0) === 1) {
    const pMonData = m.u32((u1 + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        const pOwnerGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
        if (pOwnerGame !== 0) {
          const ownerId = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
          const ownerType = m.u32((pAiGen + 0x30) >>> 0) | 0
          const pOwner = SUNIT_GetServerUnit113c(m, pOwnerGame, ownerType, ownerId)
          if (pOwner !== 0) u1 = pOwner >>> 0
        }
      }
    }
  }

  if (u2 !== 0 && (m.u32(u2) | 0) === 1) {
    const pMonData = m.u32((u2 + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        const pOwnerGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
        if (pOwnerGame !== 0) {
          const ownerId = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
          const ownerType = m.u32((pAiGen + 0x30) >>> 0) | 0
          const pOwner = SUNIT_GetServerUnit113c(m, pOwnerGame, ownerType, ownerId)
          if (pOwner !== 0) u2 = pOwner >>> 0
        }
      }
    }
  }

  if (u1 === u2) return 1
  if (u1 === 0 || (m.u32(u1) | 0) !== 0 || u2 === 0 || (m.u32(u2) | 0) !== 0) {
    return UNITS_AreUnitsAligned113c(m, u1, u2)
  }

  const pGame1 = m.u32((u1 + 0x80) >>> 0) >>> 0
  const party1 =
    pGame1 !== 0 ? (D2GAME_PARTY_GetPartyIdForUnit113c(m, u1, pGame1) & 0xffff) : 0xffff
  const pGame2 = m.u32((u2 + 0x80) >>> 0) >>> 0
  const party2 =
    pGame2 !== 0 ? (D2GAME_PARTY_GetPartyIdForUnit113c(m, u2, pGame2) & 0xffff) : 0xffff

  if (party1 === party2 && party2 !== 0xffff) {
    return 1
  }
  return 0
}

/**
 * Core triggered-skill execution engine (`D2Game.dll` `0x6FD114F0`): saves caster path target and
 * `0x40` unit flag, applies `Skills.txt` `ItemTarget` (`+0x120`: `1`=self, `2`=random pos, `3`=corpse,
 * `4`=attacker), runs `SKILLS_ExecuteSkillStart113c` + `SKILLS_ExecuteSkillDoFunc113c`, and restores
 * caster path target and `0x40` unit flag.
 *
 * @va D2Game:0x6FD114F0
 */
export function SKILLS_CastTriggeredSkillCore113c(
  m: Memory113c,
  pTargetUnit: number,
  pCasterUnit: number,
  pGame: number,
  nSkillId: number,
  nSkillLevel: number,
  nX: number,
  nY: number,
  pOutTargetType: number,
  pOutTargetId: number,
  pOutX: number,
  pOutY: number,
  bConsumeMana: number,
): number {
  const skillId = nSkillId | 0
  if (skillId <= 0 || pCasterUnit === 0) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return 0
  if (m.u16((pSkillsTxt + 0x16a) >>> 0) === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pCasterUnit, pGame)
  const pPath = m.u32((pCasterUnit + 0x2c) >>> 0) >>> 0
  let savedTargetUnit = PATH_GetTargetUnit113c(m, pPath)
  if (savedTargetUnit === pCasterUnit) savedTargetUnit = 0
  const savedX = PATH_GetFirstPointX113c(m, pPath) | 0
  const savedY = PATH_GetFirstPointY113c(m, pPath) | 0
  const savedBit6 = (m.u32((pCasterUnit + 0xc4) >>> 0) >>> 6) & 1

  if (pTargetUnit !== 0) {
    UNITS_SetTargetUnitForDynamicUnit113c(m, pCasterUnit, pTargetUnit)
  } else {
    PATH_SetTargetPos113c(m, pPath, nX | 0, nY | 0)
  }

  if (pOutTargetType !== 0) {
    m.setU32(pOutTargetType >>> 0, 6)
    if (pOutTargetId !== 0) {
      m.setU32(pOutTargetId >>> 0, 0xffffffff)
    }
  }
  if (pOutX !== 0) {
    m.setU32(pOutX >>> 0, 0)
    if (pOutY !== 0) {
      m.setU32(pOutY >>> 0, 0)
    }
  }

  let result = 0
  let targetOk = true
  const itemTargetMode = m.u8((pSkillsTxt + 0x120) >>> 0)
  switch (itemTargetMode) {
    case 1:
      UNITS_SetTargetUnitForDynamicUnit113c(m, pCasterUnit, pCasterUnit)
      if (pOutTargetType !== 0) {
        m.setU32(pOutTargetType >>> 0, m.u32(pCasterUnit >>> 0))
        if (pOutTargetId !== 0) {
          m.setU32(pOutTargetId >>> 0, m.u32((pCasterUnit + 0x0c) >>> 0))
        }
      }
      break
    case 2:
      if (pickRandomTriggeredSkillPosition(m, pCasterUnit) === 0) {
        targetOk = false
      } else {
        const pCurPath = m.u32((pCasterUnit + 0x2c) >>> 0) >>> 0
        if (pOutX !== 0) {
          m.setU32(pOutX >>> 0, PATH_GetFirstPointX113c(m, pCurPath) >>> 0)
        }
        if (pOutY !== 0) {
          m.setU32(pOutY >>> 0, PATH_GetFirstPointY113c(m, pCurPath) >>> 0)
        }
      }
      break
    case 3:
      if (
        resolveTriggeredSkillCorpseTarget(
          m,
          pGame,
          pCasterUnit,
          skillId,
          nSkillLevel,
          pOutTargetType,
          pOutTargetId,
        ) === 0
      ) {
        targetOk = false
      }
      break
    case 4:
      if (
        resolveTriggeredSkillTargetOrAttacker(
          m,
          pGame,
          pCasterUnit,
          pOutTargetType,
          pOutTargetId,
        ) === 0
      ) {
        targetOk = false
      }
      break
    default:
      break
  }

  if (targetOk) {
    let startOk = 1
    if ((m.u8((pSkillsTxt + 0x08) >>> 0) & readGdwBitMaskByte(m, 0x04)) !== 0) {
      startOk = SKILLS_ExecuteSkillStart113c(m, skillId, pGame, pCasterUnit, nSkillLevel, 1)
    }
    if (startOk !== 0) {
      result = SKILLS_ExecuteSkillDoFunc113c(
        m,
        pCasterUnit,
        pGame,
        skillId,
        nSkillLevel,
        bConsumeMana,
        1,
        1,
      )
    }
  }

  if (savedTargetUnit !== 0) {
    UNITS_SetTargetUnitForDynamicUnit113c(m, pCasterUnit, savedTargetUnit)
  } else {
    const pCurPath = m.u32((pCasterUnit + 0x2c) >>> 0) >>> 0
    PATH_SetTargetPos113c(m, pCurPath, savedX, savedY)
  }

  const postFlags = m.u32((pCasterUnit + 0xc4) >>> 0) >>> 0
  if (savedBit6 !== 0) {
    m.setU32((pCasterUnit + 0xc4) >>> 0, (postFlags | 0x40) >>> 0)
  } else {
    m.setU32((pCasterUnit + 0xc4) >>> 0, (postFlags & ~0x40) >>> 0)
  }
  return result
}

/**
 * Triggers `nSkillId` at `nSkillLevel` from `pCasterUnit` (`ecx`) onto `pTargetUnit` (`eax`),
 * guarding against `STATE_UNINTERRUPTIBLE` (`0x36`), and queues `0x99` skill-cast notification.
 *
 * @va D2Game:0x6FD117E0
 */
export function SKILLS_TriggerSkillOnTarget113c(
  m: Memory113c,
  pTargetUnit: number,
  pCasterUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  bConsumeMana: number,
): number {
  if (pCasterUnit === 0 || pTargetUnit === 0) return 0
  const pGame = m.u32((pCasterUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) return 0
  if (STATES_CheckState113c(m, pCasterUnit, 0x36) !== 0) return 0

  const sp = itemdefGapStackPtr
  itemdefGapStackPtr = (sp + 0x18) >>> 0
  const pOutTargetType = sp
  const pOutTargetId = (sp + 0x04) >>> 0
  const pOutX = (sp + 0x08) >>> 0
  const pOutY = (sp + 0x0c) >>> 0
  try {
    m.setU32(pOutTargetType, 6)
    m.setU32(pOutTargetId, 0xffffffff)
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)

    const ok = SKILLS_CastTriggeredSkillCore113c(
      m,
      pTargetUnit,
      pCasterUnit,
      pGame,
      nSkillId,
      nSkillLevel,
      0,
      0,
      pOutTargetType,
      pOutTargetId,
      pOutX,
      pOutY,
      bConsumeMana,
    )
    if (ok === 0) return 0

    let notifyType = m.u32(pOutTargetType) | 0
    let notifyId = m.u32(pOutTargetId) >>> 0
    if (notifyType === 6) {
      notifyType = m.u32(pTargetUnit >>> 0) | 0
      notifyId = m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0
    }

    UNIT_QueueSkillCastNotify99_113c(
      m,
      pCasterUnit,
      nSkillId,
      nSkillLevel,
      notifyType,
      notifyId,
      bConsumeMana,
    )
    return 1
  } finally {
    itemdefGapStackPtr = sp
  }
}
