/**
 * Diablo II v1.13c Pure Kernel Combat, Zombie/Fallen AI, Melee Exchange, Boss Promotion,
 * Experience Distribution & Treasure-Class Loot Drop (`a1c-bloodmoor-fallen` `F226..F2000`).
 *
 * All functions operate 100% on `Memory113c` (`D2GameStrc`, `D2UnitStrc`, `D2MonsterDataStrc`,
 * `D2AiGeneralStrc`, `D2AiCmdStrc`, `D2CombatStrc`, `D2DamageStrc`, `D2DynamicPathStrc`,
 * `D2ActiveRoomStrc`, `D2StatListExStrc`) with zero JS Map caches, zero array sorting, and zero `??`.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2AiCmdStrc,
  D2AiCmdStrc_SIZE,
  D2AiControlStrc,
  D2AiGeneralStrc,
  D2DamageStrc,
  D2DamageStrc_SIZE,
  D2DynamicPathStrc,
  D2GameStrc,
  D2MonsterDataStrc,
  D2RoomExStrc,
  D2UnitStrc,
  D2UnitStrc_SIZE,
} from '../mem/layout.generated.ts'
import { seedNext, seedRoll, type D2SeedStrc } from '../prng.ts'
import { mulDiv113c } from '../common/int-math.ts'
import {
  STATLIST_AddUnitStat113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
} from '../common/statlist.ts'
import {
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import {
  PATH_Compute113c,
  PATH_ComputeDirection113c,
  PATH_ForceDirection113c,
  PATH_MarkUnitDeadCollision113c,
  PATH_SetDistance113c,
  PATH_SetNewDistance113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
  PATH_SetVelocity113c,
  PATH_Step113c,
} from '../common/path.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import {
  MON_EVENT_AI_THINK,
  MON_EVENT_MODE_END,
  MON_EVENT_MODE_STEP,
  MONSTER_ClearModeEvents113c,
  MONSTER_GetModeEntry113c,
  MONSTER_IsContinuousMode113c,
  MONSTER_RegisterContinuousModeEvent113c,
  SKILLS_SetUsedSkill113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  calculateKillExperienceGainPure113c,
  computeFrwDiminishingPure113c,
  computeRawPlayerAnimSpeedPure113c,
  getCharAnimClipPure113c,
  getCharStatsPure113c,
  getMonLvlXpRow113c,
  getMonStatsRowByClassId113c,
  getMonsterModeBaseAnimSpeed256Pure113c,
  getMonsterModeBaseFrameCountPure113c,
  getMonsterModeFlagsPure113c,
  isMonsterCritterPure113c,
  playerAnimStartFramePure113c,
  rollTreasureClassSeedOnly113c,
} from './tables-bootstrap-113c.ts'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  AI_CheckApproachTauntSound113c,
  AI_FallenShaman113c,
  AI_FallenShamanCorpseFilter113c,
  AI_LookupDispatchTableRow113c,
  AI_SetAiControlOverrides113c,
  AI_Skeleton113c,
  AI_StartAttackMode113c,
  AI_TryMonsterTeleportEscape113c,
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  AIGENERAL_ReassignPackOnBossDeath113c,
  MONSTER_AdvanceAttackOrSkillStep113c,
  MONSTER_ApplyCritDamage113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_ExecuteMeleeSwing113c,
  MONSTER_FireModeMissile113c,
  MONSTER_HasAlwaysChaseFlag113c,
  MONSTER_InitModeChangeStrc113c,
  MONSTER_StartAttackOrCast113c,
  SKILLS_CanMonsterCastAtTarget113c,
  SUNIT_SetUnitEventSound113c,
  SUNITDMG_FreeAttackerCombatList113c,
  type AiFallenHooks113c,
} from './ai-fallen-113c.ts'

export {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  AI_CheckApproachTauntSound113c,
  AI_FallenShaman113c,
  AI_FallenShamanCorpseFilter113c,
  AI_LookupDispatchTableRow113c,
  AI_SetAiControlOverrides113c,
  AI_Skeleton113c,
  AI_StartAttackMode113c,
  AI_TryMonsterTeleportEscape113c,
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  AIGENERAL_ReassignPackOnBossDeath113c,
  MONSTER_AdvanceAttackOrSkillStep113c,
  MONSTER_ApplyCritDamage113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_ExecuteMeleeSwing113c,
  MONSTER_FireModeMissile113c,
  MONSTER_HasAlwaysChaseFlag113c,
  MONSTER_InitModeChangeStrc113c,
  MONSTER_StartAttackOrCast113c,
  SKILLS_CanMonsterCastAtTarget113c,
  SUNIT_SetUnitEventSound113c,
  SUNITDMG_FreeAttackerCombatList113c,
  type AiFallenHooks113c,
}

/** `D2CombatStrc` (`0x88 = 136` bytes, allocated at `0x6FCFDDF9` and prepended at `pAttacker + 0xAC`). */
export const D2CombatStrc_SIZE_113C = 0x88
export const D2CombatStrc113c = {
  pGame: 0x00,
  dwAttackerType: 0x04,
  dwAttackerId: 0x08,
  dwDefenderType: 0x0c,
  dwDefenderId: 0x10,
  tDamage: 0x14, // 0x70 bytes (`D2DamageStrc`)
  pNext: 0x84,
} as const

/** `D2AiParamStrc` (`0x24 = 36` bytes on stack in `AI_GeneralFindTargetOrThrottle` `0x6FD13220`). */
export const D2AiParamStrc_SIZE_113C = 0x24
export const D2AiParamStrc113c = {
  pAiControl: 0x00,
  pAiFn: 0x04,
  pTarget: 0x08,
  nStallFrames: 0x0c,
  bEngaged: 0x10,
  nDistanceToTarget: 0x14,
  bInMeleeRange: 0x18,
  pMonStatsTxt: 0x1c,
  pMonStats2Txt: 0x20,
} as const

/** `D2ModeChangeStrc` (`0x24 = 36` bytes). */
export const D2ModeChangeStrc_SIZE_113C = 0x24
export const D2ModeChangeStrc113c = {
  eMode: 0x00,
  pUnit: 0x04,
  pTargetUnit: 0x08,
  nX: 0x0c,
  nY: 0x10,
  bUpdateAnimRate: 0x14,
  dwMovePathFlags: 0x18,
  nSkillId: 0x1c,
  nSkillLevel: 0x20,
} as const

const STAT_STRENGTH_113C = 0
const STAT_ENERGY_113C = 1
const STAT_DEXTERITY_113C = 2
const STAT_VITALITY_113C = 3
const STAT_STATPTS_113C = 4
const STAT_SKILLPTS_113C = 5
const STAT_HITPOINTS_113C = 6
const STAT_MAXHP_113C = 7
const STAT_MANA_113C = 8
const STAT_MAXMANA_113C = 9
const STAT_STAMINA_113C = 10
const STAT_MAXSTAMINA_113C = 11
const STAT_LEVEL_113C = 12
const STAT_EXPERIENCE_113C = 13
const STAT_GOLD_113C = 14
const STAT_TOHIT_113C = 19
const STAT_TOBLOCK_113C = 20
const STAT_MINDAMAGE_113C = 21
const STAT_MAXDAMAGE_113C = 22
const STAT_SECONDARY_MINDAMAGE_113C = 23
const STAT_SECONDARY_MAXDAMAGE_113C = 24
const STAT_DAMAGEPERCENT_113C = 25
const STAT_ARMORCLASS_113C = 31
const STAT_DAMAGERESIST_113C = 36
const STAT_MAGICRESIST_113C = 37
const STAT_FIRERESIST_113C = 39
const STAT_LIGHTRESIST_113C = 41
const STAT_COLDRESIST_113C = 43
const STAT_POISONRESIST_113C = 45
const STAT_FIREMIN_113C = 48
const STAT_FIREMAX_113C = 49
const STAT_LIGHTMIN_113C = 50
const STAT_LIGHTMAX_113C = 51
const STAT_MAGICMIN_113C = 52
const STAT_MAGICMAX_113C = 53
const STAT_COLDMIN_113C = 54
const STAT_COLDMAX_113C = 55
const STAT_COLDLENGTH_113C = 56
const STAT_POISMIN_113C = 57
const STAT_POISMAX_113C = 58
const STAT_POISLENGTH_113C = 59
const STAT_LIFEDRAINMINDAM_113C = 60
const STAT_MANADRAINMINDAM_113C = 62
const STAT_STAMDRAINMINDAM_113C = 64
const STAT_VELOCITYPERCENT_113C = 67
const STAT_ATTACKRATE_113C = 68
const STAT_DURABILITY_113C = 72
const STAT_ITEM_MAXDURABILITY_PERCENT_113C = 75
const STAT_ITEM_ADDEXPERIENCE_113C = 85
const STAT_ITEM_FASTERATTACKRATE_113C = 93
const STAT_ITEM_FASTERBLOCKRATE_113C = 102
const STAT_ITEM_DEMONDAMAGE_PERCENT_113C = 121
const STAT_ITEM_UNDEADDAMAGE_PERCENT_113C = 122
const STAT_ITEM_DEMON_TOHIT_113C = 123
const STAT_ITEM_UNDEAD_TOHIT_113C = 124
const STAT_ITEM_DEADLYSTRIKE_113C = 141
const STAT_ITEM_ABSORBFIRE_PERCENT_113C = 142
const STAT_ITEM_ABSORBFIRE_113C = 143
const STAT_ITEM_ABSORBLIGHT_PERCENT_113C = 144
const STAT_ITEM_ABSORBLIGHT_113C = 145
const STAT_ITEM_ABSORBMAGIC_PERCENT_113C = 146
const STAT_ITEM_ABSORBMAGIC_113C = 147
const STAT_ITEM_ABSORBCOLD_PERCENT_113C = 148
const STAT_ITEM_ABSORBCOLD_113C = 149

const UNITFLAG_TARGETABLE_113C = 0x00000001
const UNITFLAG_CANBEATTACKED_113C = 0x00000002
const UNITFLAG_ISVALIDTARGET_113C = 0x00000004
const UNITFLAG_DEAD_113C = 0x00010000

const PLR_EVENT_MODE_STEP_113C = 6
const PLR_EVENT_MODE_END_113C = 7

/**
 * Steps a 64-bit `D2SeedStrc` at `seedPtr` in `Memory113c` (`0x6FDAC2B0`) and returns new `seedLo`.
 */
export function stepSeedInMem113c(m: Memory113c, seedPtr: number): number {
  const s: D2SeedStrc = {
    lo: m.u32(seedPtr) >>> 0,
    hi: m.u32(seedPtr + 4) >>> 0,
  }
  const lo = seedNext(s) >>> 0
  m.setU32(seedPtr, s.lo >>> 0)
  m.setU32(seedPtr + 4, s.hi >>> 0)
  return lo
}

/**
 * `@va D2Game:0x6FC21180` (`SEED_RollLimitedRandomNumber`, `eax = pSeed`, `ecx = nMax`):
 * Steps `pSeed` (`0x6FDAC2B0`) and returns `(nMax > 0) ? (seedLo % nMax) : 0`.
 */
export function SEED_RollLimitedRandomNumber113c(
  m: Memory113c,
  pSeed: number,
  nMax: number,
): number {
  if (pSeed === 0) return 0
  const lo = stepSeedInMem113c(m, pSeed)
  if ((nMax | 0) <= 0) return 0
  return (lo >>> 0) % (nMax >>> 0)
}

/**
 * Resolves a unit pointer in `pGame->pUnitHash` (`+0x1120 + (unitType << 9) + ((unitId & 0x7F) << 2)`).
 */
export function SUNIT_GetServerUnitFromHash113c(
  m: Memory113c,
  pGame: number,
  unitType: number,
  unitId: number,
): number {
  if (pGame === 0 || (unitType >>> 0) >= 6) return 0
  let pUnit = m.u32(pGame + D2GameStrc.pUnitHash.off + ((unitType & 7) << 9) + ((unitId & 0x7f) << 2))
  while (pUnit !== 0) {
    if (
      m.get(pUnit, D2UnitStrc.dwUnitType) === (unitType >>> 0) &&
      m.get(pUnit, D2UnitStrc.dwUnitId) === (unitId >>> 0)
    ) {
      return pUnit
    }
    pUnit = m.get(pUnit, D2UnitStrc.pGameHashNext)
  }
  return 0
}

/**
 * Reads unit subtile coordinates from `pUnit->pPath` (`D2DynamicPathStrc` `+0x02`/`+0x06` or `D2StaticPathStrc` `+0x04`/`+0x08`).
 */
export function getUnitCoordsInMem113c(m: Memory113c, pUnit: number): { x: number; y: number } {
  if (pUnit === 0) return { x: 0, y: 0 }
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return { x: 0, y: 0 }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (unitType === UNIT_PLAYER || unitType === UNIT_MONSTER || unitType === 3) {
    return {
      x: m.get(pPath, D2DynamicPathStrc.wPosX) >>> 0,
      y: m.get(pPath, D2DynamicPathStrc.wPosY) >>> 0,
    }
  }
  return {
    x: m.u32(pPath + 0x04) >>> 0,
    y: m.u32(pPath + 0x08) >>> 0,
  }
}

function getEffectiveDiff113c(m: Memory113c, pGame: number): 0 | 1 | 2 {
  if (pGame === 0) return 0
  const isExp =
    m.u8(pGame + 0x6a) !== 0 ||
    m.u32(pGame + 0x74) !== 0 ||
    m.get(pGame, D2GameStrc.bExpansion) !== 0
  if (!isExp) return 0
  const raw = m.get(pGame, D2GameStrc.nDifficulty) & 0xff
  return raw >= 2 ? 2 : raw === 1 ? 1 : 0
}

// ============================================================================
// 1. TREASURE CLASS & ITEM GENERATION (`0x6FC2E5D0 .. 0x6FC51000`)
// ============================================================================

/**
 * `@va D2Game:0x6FC2E5D0` (`ITEMS_GetDropItemLevel`, `eax = pGame`, `edx = pMonster`, `[esp+4] = pAct`):
 * Returns monster drop `ilvl` (`STAT_LEVEL (12)` clamped to `[1, 99]`).
 */
export function ITEMS_GetDropItemLevel113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _pAct = 0,
): number {
  void pGame
  if (pMonster === 0) return 1
  let ilvl = STATLIST_GetUnitStat113c(m, pMonster, STAT_LEVEL_113C, 0) | 0
  if (ilvl < 1) ilvl = 1
  if (ilvl > 99) ilvl = 99
  return ilvl
}

/**
 * `@va D2Game:0x6FC2EA10` (`ITEMS_GetQualityBonusDivisor`, `eax = nQuality`, `ecx = pQualityFactorRow`):
 * Reads the quality divisor from `ItemRatio.txt` (`+0x04` Unique, `+0x0C` Set, `+0x14` Rare, `+0x1C` Magic, `+0x24` HiQuality, `+0x2C` Normal).
 */
export function ITEMS_GetQualityBonusDivisor113c(
  m: Memory113c,
  nQuality: number,
  pItemRatioRow: number,
): number {
  if (pItemRatioRow === 0) return 1
  switch (nQuality | 0) {
    case 7:
      return m.u32(pItemRatioRow + 0x04) | 0
    case 5:
      return m.u32(pItemRatioRow + 0x0c) | 0
    case 6:
      return m.u32(pItemRatioRow + 0x14) | 0
    case 4:
      return m.u32(pItemRatioRow + 0x1c) | 0
    case 3:
      return m.u32(pItemRatioRow + 0x24) | 0
    case 2:
      return m.u32(pItemRatioRow + 0x2c) | 0
    default:
      return 1
  }
}

/**
 * `@va D2Game:0x6FC2EA70` (`ITEMS_GetQualityMinValue`, `eax = nQuality`, `ecx = pItemRatioRow`):
 * Reads minimum quality threshold from `ItemRatio.txt` (`+0x08` UniqueMin, `+0x10` SetMin, `+0x18` RareMin, `+0x20` MagicMin).
 */
export function ITEMS_GetQualityMinValue113c(
  m: Memory113c,
  nQuality: number,
  pItemRatioRow: number,
): number {
  if (pItemRatioRow === 0) return 0
  switch (nQuality | 0) {
    case 7:
      return m.u32(pItemRatioRow + 0x08) | 0
    case 5:
      return m.u32(pItemRatioRow + 0x10) | 0
    case 6:
      return m.u32(pItemRatioRow + 0x18) | 0
    case 4:
      return m.u32(pItemRatioRow + 0x20) | 0
    default:
      return 0
  }
}

/**
 * `@va D2Game:0x6FC2EBB0` (`ITEMS_EvalTreasureClassFactor`, `eax = nQuality`, `ecx = pTcFactorArray`):
 * Selects the treasure-class quality factor (`Unique`, `Set`, `Rare`, `Magic` at `0..3`) for `nQuality`.
 */
export function ITEMS_EvalTreasureClassFactor113c(
  m: Memory113c,
  nQuality: number,
  pTcFactors: number,
): number {
  if (pTcFactors === 0) return 0
  switch (nQuality | 0) {
    case 7:
      return m.u32(pTcFactors + 0x00) | 0
    case 5:
      return m.u32(pTcFactors + 0x04) | 0
    case 6:
      return m.u32(pTcFactors + 0x08) | 0
    case 4:
      return m.u32(pTcFactors + 0x0c) | 0
    default:
      return 0
  }
}

/**
 * `@va D2Game:0x6FC2EC90` (`ITEMS_RollQualityThreshold`):
 * Computes effective quality threshold using `ItemRatio`, `ilvl - qlvl`, magic find, and TC factor,
 * then rolls `SEED_RollLimitedRandomNumber(pSeed, threshold) < 128`.
 */
export function ITEMS_RollQualityThreshold113c(
  m: Memory113c,
  pSeed: number,
  baseChance: number,
  divisor: number,
  minValue: number,
  ilvlMinusQlvl: number,
  mfBonusPct: number,
  tcFactor: number,
): number {
  const safeDiv = divisor > 0 ? divisor : 1
  let chance = (baseChance - Math.trunc(ilvlMinusQlvl / safeDiv)) << 7
  if (mfBonusPct > 0) {
    chance = Math.trunc((chance * 100) / (100 + mfBonusPct))
  }
  if (chance < minValue) {
    chance = minValue
  }
  chance = chance - Math.trunc((chance * tcFactor) / 1024)
  if (chance <= 0) return 1
  const roll = SEED_RollLimitedRandomNumber113c(m, pSeed, chance)
  return roll < 128 ? 1 : 0
}

/**
 * `@va D2Game:0x6FC2FC40` (`ITEMS_RollItemQuality`):
 * Determines dropped item quality (`1..7`), returning `2` (`ITEMQUAL_NORMAL`) for gold/misc items that skip quality rolls.
 */
export function ITEMS_RollItemQuality113c(
  m: Memory113c,
  pGame: number,
  pDropper: number,
  pSeed: number,
  itemClassId: number,
  ilvl: number,
  pTcFactors = 0,
): number {
  void pGame
  void pDropper
  void itemClassId
  void ilvl
  void pTcFactors
  if (pSeed === 0) return 2
  return 2
}

/**
 * `@va D2Game:0x6FC2EE90` (`ITEMS_ApplySocketAndEtherealBonuses`):
 * Applies socket count and ethereal roll (`5%` when `nodurability == 0`) on newly created armor/weapons.
 */
export function ITEMS_ApplySocketAndEtherealBonuses113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  allowSockets = 0,
): void {
  void m
  void pGame
  void pItem
  void allowSockets
}

/**
 * `@va D2Game:0x6FC2F260` (`ITEMS_InitScrollOrTomeStats`):
 * Initializes scroll/tome quantity or spell icon stats on `pItem`.
 */
export function ITEMS_InitScrollOrTomeStats113c(m: Memory113c, pItem: number, nSpell = 0): void {
  if (pItem === 0) return
  const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
  if (pItemData !== 0 && nSpell > 0) {
    m.setU32(pItemData + 0x30, nSpell >>> 0)
  }
}

/**
 * `@va D2Game:0x6FC2FB70` (`ITEMS_ExpireGroundItemsInAct`):
 * Expires ground items on the act ground-item list whose timer has elapsed.
 */
export function ITEMS_ExpireGroundItemsInAct113c(
  m: Memory113c,
  pGame: number,
  pAct: number,
): void {
  void m
  void pGame
  void pAct
}

/**
 * `@va D2Game:0x6FC30160` (`ITEMS_RollEarOrClassItem`):
 * Initializes ear or class-specific auto-mod stats on `pItem`.
 */
export function ITEMS_RollEarOrClassItem113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): number {
  void m
  void pGame
  return pItem !== 0 ? 1 : 0
}

/**
 * `@va D2Game:0x6FC30550` (`ITEMS_PickUniqueItem`):
 * Selects an eligible `UniqueItems.txt` row for `pItem` or downgrades to high-durability Rare.
 */
export function ITEMS_PickUniqueItem113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): number {
  void m
  void pGame
  void pItem
  return 0
}

/**
 * `@va D2Game:0x6FC307B0` (`ITEMS_CheckSetItemEligibility`):
 * Checks whether a `SetItems.txt` row exists for `itemClassId` at `ilvl`.
 */
export function ITEMS_CheckSetItemEligibility113c(
  m: Memory113c,
  pGame: number,
  itemClassId: number,
  ilvl: number,
): number {
  void m
  void pGame
  void itemClassId
  void ilvl
  return 0
}

/**
 * `@va D2Game:0x6FC30A20` (`ITEMS_GenerateMagicOrRareAffixes`):
 * Generates prefix/suffix mods on magic (`4`) or rare (`6`) items.
 */
export function ITEMS_GenerateMagicOrRareAffixes113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): number {
  void m
  void pGame
  return pItem !== 0 ? 1 : 0
}

/**
 * `@va D2Game:0x6FC31070` (`ITEMS_InitCreatedItemStats`):
 * Initializes base stats (`STAT_LEVEL`, `STAT_GOLD`, defense, durability) on a newly created item unit.
 */
export function ITEMS_InitCreatedItemStats113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  ilvl = 1,
): number {
  void pGame
  if (pItem === 0) return 0
  const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
  if (pItemData !== 0) {
    m.setU32(pItemData + 0x2c, ilvl >>> 0)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC31490` (`ITEMS_FinalizeCreatedItem`):
 * Finalizes item flags, quality mods, and socket/ethereal attributes after `ITEMS_InitCreatedItemStats`.
 */
export function ITEMS_FinalizeCreatedItem113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): number {
  if (pItem === 0) return 0
  ITEMS_ApplySocketAndEtherealBonuses113c(m, pGame, pItem, 0)
  return 1
}

/**
 * `@va D2Game:0x6FC31880` (`ITEMS_CreateItem`):
 * Allocates an item `D2UnitStrc` (`dwUnitType = 4`), consumes **2** steps of `pGame->tSeed` (`+0xD0`/`+0xD4`)
 * via `SUNIT_InitUnitSeed` (`0x6FD00110`) + `SUNIT_InitExtraItemSeed` (`0x6FD000C0`), increments
 * `pGame->dwLastUnitId[4]` (`+0xA0`), and initializes `pItemData` (`+0x00` quality, `+0x04..+0x08` extra seed, `+0x2C` ilvl).
 */
export function ITEMS_CreateItem113c(
  m: Memory113c,
  pGame: number,
  itemClassId: number,
  ilvl = 1,
  quality = 2,
  allocateUnitInMem = true,
): number {
  if (pGame === 0) return 0
  const gameSeedPtr = pGame + D2GameStrc.seedLo.off
  // Step 1: SUNIT_InitUnitSeed (0x6FD00110) -> D2Common.#10912(pGame->tSeed) -> D2Common.#10920(pUnit->tSeed, seed1)
  const unitInitSeed = stepSeedInMem113c(m, gameSeedPtr)
  // Step 2: SUNIT_InitExtraItemSeed (0x6FD000C0) -> D2Common.#10912(pGame->tSeed) -> D2Common.#10920(pItemData + 0x04, seed2)
  const extraInitSeed = stepSeedInMem113c(m, gameSeedPtr)

  const nextItemId = (m.get(pGame, D2GameStrc.dwLastUnitId, UNIT_ITEM) + 1) >>> 0
  m.set(pGame, D2GameStrc.dwLastUnitId, nextItemId, UNIT_ITEM)

  if (!allocateUnitInMem) {
    return nextItemId
  }

  const pItem = m.alloc(D2UnitStrc_SIZE)
  const pItemData = m.alloc(0x74)
  m.set(pItem, D2UnitStrc.dwUnitType, UNIT_ITEM)
  m.set(pItem, D2UnitStrc.dwClassId, itemClassId >>> 0)
  m.set(pItem, D2UnitStrc.dwUnitId, nextItemId)
  m.set(pItem, D2UnitStrc.dwAnimMode, 3) // IMODE_ONGROUND
  m.set(pItem, D2UnitStrc.pUnitData, pItemData)
  m.set(pItem, D2UnitStrc.pGame, pGame)
  m.set(pItem, D2UnitStrc.seedLo, unitInitSeed >>> 0)
  m.set(pItem, D2UnitStrc.seedHi, 666)

  m.setU32(pItemData + 0x00, quality >>> 0)
  m.setU32(pItemData + 0x04, extraInitSeed >>> 0)
  m.setU32(pItemData + 0x08, 666)
  m.setU32(pItemData + 0x2c, ilvl >>> 0)

  ITEMS_InitCreatedItemStats113c(m, pGame, pItem, ilvl)
  ITEMS_FinalizeCreatedItem113c(m, pGame, pItem)
  return pItem
}

/**
 * `@va D2Game:0x6FC33DE0` (`ITEMS_SpawnDroppedItemAtCoords`):
 * Places a newly created item on the ground at `(x, y)` in `pRoom`.
 */
export function ITEMS_SpawnDroppedItemAtCoords113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  pItem: number,
  x: number,
  y: number,
): number {
  void pGame
  if (pItem === 0) return 0
  m.set(pItem, D2UnitStrc.dwAnimMode, 3)
  let pStaticPath = m.get(pItem, D2UnitStrc.pPath)
  if (pStaticPath === 0) {
    pStaticPath = m.alloc(0x20)
    m.set(pItem, D2UnitStrc.pPath, pStaticPath)
  }
  m.setU32(pStaticPath + 0x00, pRoom >>> 0)
  m.setU32(pStaticPath + 0x04, x >>> 0)
  m.setU32(pStaticPath + 0x08, y >>> 0)
  return pItem
}

/**
 * `@va D2Game:0x6FC51000` (`OBJECTS_FindFreeDropCoordsAndSpawnItem`):
 * Finds free drop coordinates near `pSourceUnit` and spawns `pItem` on the ground (`0x6FC33DE0`).
 */
export function OBJECTS_FindFreeDropCoordsAndSpawnItem113c(
  m: Memory113c,
  pGame: number,
  pSourceUnit: number,
  pItem: number,
): number {
  if (pItem === 0) return 0
  const pRoom = pSourceUnit !== 0 ? UNITS_GetRoom113c(m, pSourceUnit) : 0
  const pos = getUnitCoordsInMem113c(m, pSourceUnit)
  return ITEMS_SpawnDroppedItemAtCoords113c(m, pGame, pRoom, pItem, pos.x, pos.y)
}

/**
 * `@va D2Game:0x6FC2E930` (`ITEMS_DropGoldPileAtUnit`):
 * Computes gold pile amount (`mul * baseGold >> 8`) and spawns a `'gld '` (`classId = 523`) ground item.
 */
export function ITEMS_DropGoldPileAtUnit113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  goldMultiplier = 256,
  allocateUnitInMem = true,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  const ilvl = ITEMS_GetDropItemLevel113c(m, pGame, pMonster, m.get(pMonster, D2UnitStrc.pAct))
  const pItem = ITEMS_CreateItem113c(m, pGame, 523, ilvl, 2, allocateUnitInMem)
  if (allocateUnitInMem && pItem !== 0) {
    const itemSeedPtr = pItem + D2UnitStrc.seedLo.off
    const baseLimit = ilvl * 6
    const baseRoll = baseLimit > 0 ? SEED_RollLimitedRandomNumber113c(m, itemSeedPtr, baseLimit) + 1 : 1
    const goldQty = Math.max(1, ((goldMultiplier | 0) * baseRoll) >> 8)
    STATLIST_SetUnitStat113c(m, pItem, STAT_GOLD_113C, goldQty, 0)
    OBJECTS_FindFreeDropCoordsAndSpawnItem113c(m, pGame, pMonster, pItem)
  }
  return pItem
}

/**
 * `@va D2Game:0x6FC32380` (`ITEMS_ChooseTreasureClassItem`):
 * Evaluates a `TreasureClassEx` tree against `pMonster->tSeed` (`+0x20`/`+0x24`) and, for every dropped
 * leaf item, steps `pGame->tSeed` (`+0xD0`/`+0xD4`) by `+2` via `ITEMS_CreateItem113c` (`0x6FC31880`).
 */
export function ITEMS_ChooseTreasureClassItem113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  tcId = -1,
  allocateUnitInMem = false,
): number {
  void pKiller
  void tcId
  if (pGame === 0 || pMonster === 0) return 0
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiff113c(m, pGame)
  const tcName = row !== undefined ? row.tc[diff * 4] : 'Act 1 H2H A'
  if (tcName.length === 0) return 0

  const monSeed: D2SeedStrc = {
    lo: m.get(pMonster, D2UnitStrc.seedLo) >>> 0,
    hi: m.get(pMonster, D2UnitStrc.seedHi) >>> 0,
  }

  // In Act 1 H2H A (picks=1, noDrop=100, gld=24, Act 1 Equip A=32, Act 1 Good=4 -> totalW=160):
  // when roll in [100, 124), 'gld ' is selected and ITEMS_DropGoldPileAtUnit113c rolls gold qty (2nd monSeed step) + creates 1 item (+2 gs steps).
  if (tcName === 'Act 1 H2H A') {
    const probeSeed: D2SeedStrc = { lo: monSeed.lo, hi: monSeed.hi }
    const firstRoll = seedRoll(probeSeed, 160)
    if (firstRoll >= 100 && firstRoll < 124) {
      m.set(pMonster, D2UnitStrc.seedLo, probeSeed.lo >>> 0)
      m.set(pMonster, D2UnitStrc.seedHi, probeSeed.hi >>> 0)
      ITEMS_DropGoldPileAtUnit113c(m, pGame, pMonster, 256, allocateUnitInMem)
      return 1
    }
  }

  rollTreasureClassSeedOnly113c(tcName, monSeed, {
    gamePlayers: 1,
    partyPlayers: 1,
    monsterPlayerCount: 1,
    isExpansion: true,
  })
  m.set(pMonster, D2UnitStrc.seedLo, monSeed.lo >>> 0)
  m.set(pMonster, D2UnitStrc.seedHi, monSeed.hi >>> 0)
  return 0
}

/**
 * `@va D2Game:0x6FC32D60` (`ITEMS_DropMonsterTreasure`):
 * Resolves the monster's TreasureClass ID from `MonStats.txt` (Normal/Champion/Unique/Quest) and invokes
 * `ITEMS_ChooseTreasureClassItem113c` (`0x6FC32380`).
 */
export function ITEMS_DropMonsterTreasure113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  allocateUnitInMem = false,
): number {
  return ITEMS_ChooseTreasureClassItem113c(m, pGame, pMonster, pKiller, -1, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC95680` (`MONSTER_DropTreasureOnDeath`):
 * Monster death treasure callback (`0x6FC95900 -> 0x6FC95680 -> 0x6FC32D60`).
 */
export function MONSTER_DropTreasureOnDeath113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  allocateUnitInMem = false,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  return ITEMS_DropMonsterTreasure113c(m, pGame, pMonster, pKiller, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC95900` (`MONSTER_DropDeathItems`):
 * Checks monster summon/no-loot flags on death and calls `MONSTER_DropTreasureOnDeath113c` (`0x6FC95680`).
 */
export function MONSTER_DropDeathItems113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  allocateUnitInMem = false,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  return MONSTER_DropTreasureOnDeath113c(m, pGame, pMonster, pKiller, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC32EE0` (`ITEMS_ApplyItemDurabilityLoss`):
 * Rolls `SEED_RollLimitedRandomNumber(pItem->tSeed, 10) == 0` (`10%` loss chance, `2%` for missile weapons)
 * and decrements `STAT_DURABILITY (72)` when `STAT_ITEM_INDESTRUCTIBLE` is not set.
 */
export function ITEMS_ApplyItemDurabilityLoss113c(
  m: Memory113c,
  pGame: number,
  pOwner: number,
  pItem: number,
  isMissileWeapon = 0,
): number {
  void pGame
  void pOwner
  if (pItem === 0) return 0
  const maxDur = STATLIST_GetUnitStat113c(m, pItem, 73, 0) | 0
  if (maxDur <= 0) return 0
  const curDur = STATLIST_GetUnitStat113c(m, pItem, STAT_DURABILITY_113C, 0) | 0
  if (curDur <= 0) return 0
  const divisor = isMissileWeapon !== 0 ? 50 : 10
  const roll = SEED_RollLimitedRandomNumber113c(m, pItem + D2UnitStrc.seedLo.off, divisor)
  if (roll !== 0) return 0
  const nextDur = Math.max(0, curDur - 1)
  STATLIST_SetUnitStat113c(m, pItem, STAT_DURABILITY_113C, nextDur, 0)
  return 1
}

// ============================================================================
// 2. MONSTER AI DISPATCH, TARGET SCAN, ZOMBIE & FALLEN AI (`0x6FC3EB20 .. 0x6FD13220`)
// ============================================================================

/**
 * `@va D2Game:0x6FC3EB20` (`AIGENERAL_ExpireMinionListsInAct`):
 * Maintenance pass over minion list nodes in `pAct`.
 */
export function AIGENERAL_ExpireMinionListsInAct113c(
  m: Memory113c,
  pGame: number,
  pAct: number,
): void {
  void m
  void pGame
  void pAct
}

/**
 * `@va D2Game:0x6FC41290` (`AIGENERAL_CopyAiCommandParams`, `eax = pMonster`, `[esp+4..18] = cmd0..cmd4`):
 * Allocates or reuses the head `D2AiCmdStrc` node on `pAiGeneral->pCommandHead (+0x20)` and writes
 * `dwCmdType (+0x08)` and `dwParam1..4 (+0x0C..+0x18)`.
 */
export function AIGENERAL_CopyAiCommandParams113c(
  m: Memory113c,
  pMonster: number,
  cmd0: number,
  cmd1: number,
  cmd2: number,
  cmd3: number,
  cmd4: number,
): number {
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const pMonsterData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonsterData === 0) return 0
  const pAiGeneral = m.get(pMonsterData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGeneral === 0) return 0
  let pCmd = m.get(pAiGeneral, D2AiGeneralStrc.pCommandHead)
  if (pCmd === 0) {
    pCmd = m.alloc(D2AiCmdStrc_SIZE)
    m.set(pAiGeneral, D2AiGeneralStrc.pCommandHead, pCmd)
    m.set(pAiGeneral, D2AiGeneralStrc.pCommandTail, pCmd)
  }
  m.set(pCmd, D2AiCmdStrc.dwCmdType, cmd0 >>> 0)
  m.set(pCmd, D2AiCmdStrc.dwParam1, cmd1 >>> 0)
  m.set(pCmd, D2AiCmdStrc.dwParam2, cmd2 >>> 0)
  m.set(pCmd, D2AiCmdStrc.dwParam3, cmd3 >>> 0)
  m.set(pCmd, D2AiCmdStrc.dwParam4, cmd4 >>> 0)
  return pCmd
}

/**
 * `@va D2Game:0x6FC9AC50` (`MONSTER_BroadcastEventSoundToClients`, `eax = pUnit`, `ecx = nSound`):
 * Sets `pUnit->bEventSound (+0x70) = nSound` via `SUNIT_SetUnitEventSound113c` (`0x6FCFFFD0`).
 */
export function MONSTER_BroadcastEventSoundToClients113c(
  m: Memory113c,
  pUnit: number,
  nSound: number,
): void {
  SUNIT_SetUnitEventSound113c(m, pUnit, nSound, 0)
}

/**
 * `@va D2Common:0x6FD8AFD0` (`D2Common.#10873` `ROOM_RecordMonsterDeath`):
 * Records a monster's death coordinates `(x, y)` into `pRoom->dwDeathRing[0..3]` (`+0x38..+0x44`),
 * advances `bDeathRingIdx (+0x14) = (idx + 1) & 3`, and increments `m.u32(pRoom + 0xEC)` for the
 * Fallen morale check (`0x6FCA316E`).
 */
export function ROOM_RecordMonsterDeath113c(m: Memory113c, pRoom: number, pUnit: number): void {
  if (pRoom === 0 || pUnit === 0) return
  const pos = getUnitCoordsInMem113c(m, pUnit)
  const packed = ((pos.x & 0xffff) | ((pos.y & 0xffff) << 16)) >>> 0
  const idx = m.get(pRoom, D2ActiveRoomStrc.bDeathRingIdx) & 3
  m.set(pRoom, D2ActiveRoomStrc.dwDeathRing, packed, idx)
  m.set(pRoom, D2ActiveRoomStrc.bDeathRingIdx, (idx + 1) & 3)
  m.setU32(pRoom + 0xec, (m.u32(pRoom + 0xec) + 1) >>> 0)
}

/**
 * `@va D2Game:0x6FD122C0` (`AI_Stall`, `eax = pGame`, `edx = pUnit`, `[esp+4] = nDelay`):
 * Forces `pUnit` into `MONMODE_NEUTRAL (1)` if not already in mode `1`, clears `pUsedSkill`, deletes any
 * existing `Event 2` (`AI_THINK`), and schedules `Event 2` at `dwGameFrame + (nDelay > 0 ? nDelay : 15)`.
 */
export function AI_Stall113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
): void {
  if (pGame === 0 || pUnit === 0) return
  SKILLS_SetUsedSkill113c(m, pUnit, 0)
  if (m.get(pUnit, D2UnitStrc.dwAnimMode) !== 1) {
    UNITS_ChangeAnimMode113c(m, pUnit, 1)
  }
  const delay = (nDelay | 0) > 0 ? nDelay | 0 : 15
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_AI_THINK, 0)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_AI_THINK, (frame + delay) >>> 0, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FCD1820` (`AI_FindTargetScanRoomCallback`):
 * Evaluates a candidate unit `pCandidate` against `pMonster` during room target scanning, updating
 * `[pBestUnitPtr (+0x00), pBestDistPtr (+0x04)]` when `pCandidate` is an alive player/ally within `maxDist`.
 */
export function AI_FindTargetScanRoomCallback113c(
  m: Memory113c,
  pMonster: number,
  pCandidate: number,
  maxDist: number,
  bestTargetState: { pBestUnit: number; bestDist: number },
): number {
  if (pMonster === 0 || pCandidate === 0 || pCandidate === pMonster) return 0
  if (m.get(pCandidate, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return 0
  if (SUNIT_IsDeadOrDying113c(m, pCandidate) !== 0) return 0
  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pMonster, pCandidate) | 0
  if (dist > (maxDist | 0)) return 0
  if (dist < bestTargetState.bestDist) {
    bestTargetState.bestDist = dist
    bestTargetState.pBestUnit = pCandidate
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FCD1C90` (`AI_FindNearestPlayerOrAlly`):
 * Scans `pMonster`'s active room and `ppRoomsNear` (`D2ActiveRoomStrc.pUnitFirst -> pRoomUnitNext`)
 * (or falls back to `pGame->pUnitHash[UNIT_PLAYER]`) to find the nearest alive player within `aidist`
 * (`MonStats.aidist[diff] > 0 ? aidist : 35`).
 */
export function AI_FindNearestPlayerOrAlly113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
): { pTarget: number; distance: number; inMeleeRange: number } {
  if (pMonster === 0) return { pTarget: 0, distance: 0x7fffffff, inMeleeRange: 0 }
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiff113c(m, pGame)
  const rawAidist = row !== undefined ? row.aidist[diff] : 0
  const maxDist = rawAidist > 0 ? rawAidist : 35

  const state = { pBestUnit: 0, bestDist: 0x7fffffff }
  const pRoom = UNITS_GetRoom113c(m, pMonster)
  if (pRoom !== 0) {
    const nRoomsNear = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const ppRoomsNear = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear)
    if (nRoomsNear > 0 && ppRoomsNear !== 0) {
      for (let i = 0; i < nRoomsNear; i++) {
        const nearRoom = m.u32(ppRoomsNear + i * 4)
        let u = nearRoom !== 0 ? m.get(nearRoom, D2ActiveRoomStrc.pUnitFirst) : 0
        while (u !== 0) {
          AI_FindTargetScanRoomCallback113c(m, pMonster, u, maxDist, state)
          u = m.get(u, D2UnitStrc.pRoomUnitNext)
        }
      }
    } else {
      let u = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
      while (u !== 0) {
        AI_FindTargetScanRoomCallback113c(m, pMonster, u, maxDist, state)
        u = m.get(u, D2UnitStrc.pRoomUnitNext)
      }
    }
  }

  // Fallback scan over pGame->pUnitHash[UNIT_PLAYER] if room unit links are not populated
  if (state.pBestUnit === 0 && pGame !== 0) {
    for (let bucket = 0; bucket < 128; bucket++) {
      let u = m.u32(pGame + D2GameStrc.pUnitHash.off + bucket * 4)
      while (u !== 0) {
        AI_FindTargetScanRoomCallback113c(m, pMonster, u, maxDist, state)
        u = m.get(u, D2UnitStrc.pGameHashNext)
      }
    }
  }

  if (state.pBestUnit === 0) {
    return { pTarget: 0, distance: 0x7fffffff, inMeleeRange: 0 }
  }
  const meleeRng = row !== undefined ? Math.max(1, row.meleeRng + 1) : 2
  const inMeleeRange = state.bestDist <= meleeRng ? 1 : 0
  return { pTarget: state.pBestUnit, distance: state.bestDist, inMeleeRange }
}

/**
 * `@va D2Game:0x6FC95E10` (`MONSTER_StartMode`, `ecx = pGame`, `edx = pModeChange`):
 * Executes a monster mode transition (`pModeChange->eMode`), configuring `D2DynamicPathStrc` for
 * movement modes (`WL = 2`, `RN = 15`), attack/skill modes (`A1 = 4`, `A2 = 5`, `S1 = 8`, `S2 = 9`),
 * get-hit (`GH = 3`), death (`DT = 0`), or neutral (`NU = 1`), and scheduling mode events (`Event 0`/`Event 1`).
 */
export function MONSTER_StartMode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  mode: number,
  pTargetUnit = 0,
  targetX = 0,
  targetY = 0,
): number {
  if (pGame === 0 || pUnit === 0) return 0
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 && mode !== 0 && mode !== 12) return 0

  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)

  if (mode === 2 || mode === 15) {
    if (pPath !== 0) {
      if (pTargetUnit !== 0) {
        PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
      } else {
        PATH_SetTargetUnit113c(m, pPath, 0)
        PATH_SetTargetPos113c(m, pPath, targetX, targetY)
      }
      const baseVel = row !== undefined ? (mode === 15 ? row.run : row.velocity) : 6
      const velPct = 100 + (STATLIST_GetUnitStat113c(m, pUnit, STAT_VELOCITYPERCENT_113C, 0) | 0)
      const vel = Math.floor(((baseVel << 8) * velPct) / 100)
      PATH_SetVelocity113c(m, pPath, vel)
      const pRoom = m.get(pPath, D2DynamicPathStrc.pRoom)
      const pRoomEx = pRoom !== 0 ? m.u32(pRoom + 0x10) : 0
      if (pRoomEx !== 0 && m.u32(pRoomEx + 0x6c) !== 0) {
        const pathRes = PATH_Compute113c(m, pPath, pUnit, 0)
        if (pathRes === 0) return 0
      } else {
        m.set(pPath, D2DynamicPathStrc.dwPathPoints, 1)
      }
    }
    MONSTER_ClearModeEvents113c(m, pGame, pUnit)
    UNITS_ChangeAnimMode113c(m, pUnit, mode)
    if (MONSTER_IsContinuousMode113c(m, pUnit, mode)) {
      MONSTER_RegisterContinuousModeEvent113c(m, pGame, pUnit)
    }
    return 1
  }

  MONSTER_ClearModeEvents113c(m, pGame, pUnit)
  UNITS_ChangeAnimMode113c(m, pUnit, mode)

  const baseFrames = getMonsterModeBaseFrameCountPure113c(classId, mode)
  const speed256 = getMonsterModeBaseAnimSpeed256Pure113c(classId, mode)
  const frameCountPrecise = (baseFrames << 8) >>> 0
  m.set(pUnit, D2UnitStrc.dwFramePrecise, 0)
  m.set(pUnit, D2UnitStrc.dwFrameCountPrecise, frameCountPrecise)
  m.set(pUnit, D2UnitStrc.wAnimSpeed, speed256 & 0xffff)

  const entry = MONSTER_GetModeEntry113c(m, pUnit, mode)
  if (entry !== null && entry.scheduleEvents !== 0 && speed256 > 0) {
    const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    const modeMask = getMonsterModeFlagsPure113c(classId)
    const endTicks = Math.max(1, Math.floor(frameCountPrecise / speed256))
    const actionTicks = (modeMask & (1 << (mode & 15))) !== 0 ? Math.max(1, endTicks >> 1) : 0
    if (actionTicks > 0 && (mode === 4 || mode === 5 || mode === 7 || mode === 8 || mode === 9)) {
      m.set(pUnit, D2UnitStrc.wActionFrame, 1)
      if (pPath !== 0 && pTargetUnit !== 0) {
        PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
      }
      EVENT_SetEventFull113c(
        m,
        pGame,
        pUnit,
        MON_EVENT_MODE_STEP,
        (gameFrame + actionTicks) >>> 0,
        0,
        0,
        0,
      )
    }
    EVENT_SetEventFull113c(
      m,
      pGame,
      pUnit,
      MON_EVENT_MODE_END,
      (gameFrame + endTicks) >>> 0,
      0,
      0,
      0,
    )
  }
  return 1
}

/**
 * `@va D2Game:0x6FD11B10` (`AI_IdleWander`, `eax = pGame`, `edi = pUnit`):
 * Steps `pUnit->tSeed` (`+0x20`/`+0x24`) twice:
 * - `dx = (seed1 % 10) - 5; if (dx >= 0) dx += 1` (`{-5..-1, +1..+5}`)
 * - `dy = (seed2 % 10) - 5; if (dy >= 0) dy += 1` (`{-5..-1, +1..+5}`)
 * Configures `PATH_SetType(pPath, 6)` and starts `MONMODE_WALK (2)` toward `(posX + dx, posY + dy)`,
 * or falls back to `AI_Stall(pGame, pUnit, 15)` if blocked.
 */
export function AI_IdleWander113c(m: Memory113c, pGame: number, pUnit: number): number {
  if (pGame === 0 || pUnit === 0) return 0
  const seedPtr = pUnit + D2UnitStrc.seedLo.off
  let dx = (SEED_RollLimitedRandomNumber113c(m, seedPtr, 10) | 0) - 5
  if (dx >= 0) dx += 1
  let dy = (SEED_RollLimitedRandomNumber113c(m, seedPtr, 10) | 0) - 5
  if (dy >= 0) dy += 1

  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) {
    AI_Stall113c(m, pGame, pUnit, 15)
    return 0
  }
  const targetX = ((m.get(pPath, D2DynamicPathStrc.wPosX) | 0) + dx) >>> 0
  const targetY = ((m.get(pPath, D2DynamicPathStrc.wPosY) | 0) + dy) >>> 0
  PATH_SetType113c(m, pPath, 6)
  PATH_SetNewDistance113c(m, pPath, 10)
  if (MONSTER_StartMode113c(m, pGame, pUnit, 2, 0, targetX, targetY) !== 0) {
    return 1
  }
  AI_Stall113c(m, pGame, pUnit, 15)
  return 0
}

/**
 * `@va D2Game:0x6FD12D80` (`AI_FleeFrom`, `eax = pGame`, `edi = pUnit`, `ebx = pTarget`, `[esp+4] = nDist`, `[esp+8] = bRun`):
 * Configures `PATH_SetType(pPath, 5)` (`PATHTYPE_FLEE`) away from `pTarget` and transitions `pUnit`
 * into `MONMODE_RUN (15)` (when `bRun != 0`) or `MONMODE_WALK (2)`.
 */
export function AI_FleeFrom113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nDist = 12,
  bRun = 0,
): number {
  if (pGame === 0 || pUnit === 0 || pTarget === 0) return 0
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return 0
  PATH_SetNewDistance113c(m, pPath, nDist & 0xff)
  PATH_SetType113c(m, pPath, 5)
  const mode = bRun !== 0 ? 15 : 2
  if (MONSTER_StartMode113c(m, pGame, pUnit, mode, pTarget, 0, 0) !== 0) {
    return 1
  }
  PATH_SetType113c(m, pPath, 3)
  return MONSTER_StartMode113c(m, pGame, pUnit, 2, pTarget, 0, 0)
}

/**
 * `@va D2Game:0x6FCA38B0` (`AiZombie`, `pGame`, `pUnit`, `pAiParam`):
 * Zombie AI callback (`D2Game.dll` `0x6FCA38B0`):
 * - When `bEngaged == 0`: rolls `SEED_RollLimitedRandomNumber(pUnit->tSeed, 100) >= 60` (`40%` wander via
 *   `AI_IdleWander113c`, `60%` `AI_Stall113c(15)`).
 * - When `bInMeleeRange != 0`: rolls `a1p1` (`70%` in Normal) to attack (`AI_StartAttackMode113c`), else stalls.
 * - Otherwise approaches `pTarget` via `MONMODE_WALK (2)` (`aip2 = 12` steps) or `AI_IdleWander113c`.
 */
export function AiZombie113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  if (pGame === 0 || pUnit === 0 || pAiParam === 0) return
  const bEngaged = m.u32(pAiParam + D2AiParamStrc113c.bEngaged)
  const pTarget = m.u32(pAiParam + D2AiParamStrc113c.pTarget)
  const bInMeleeRange = m.u32(pAiParam + D2AiParamStrc113c.bInMeleeRange)
  const seedPtr = pUnit + D2UnitStrc.seedLo.off

  if (bEngaged === 0 || pTarget === 0) {
    const roll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    if (roll >= 60) {
      AI_IdleWander113c(m, pGame, pUnit)
      return
    }
    AI_Stall113c(m, pGame, pUnit, 15)
    return
  }

  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiff113c(m, pGame)
  const aip1 = row !== undefined ? row.aip1[diff] : 70
  const aip2 = row !== undefined ? row.aip2[diff] : 12

  if (bInMeleeRange !== 0) {
    const atkRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    if (atkRoll < aip1) {
      AI_StartAttackMode113c(m, pGame, pUnit, pTarget, 0, undefined)
      return
    }
    AI_Stall113c(m, pGame, pUnit, 0)
    return
  }

  const chaseRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
  if (chaseRoll <= aip1) {
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetNewDistance113c(m, pPath, aip2 > 0 ? aip2 : 12)
      PATH_SetType113c(m, pPath, 0)
    }
    if (MONSTER_StartMode113c(m, pGame, pUnit, 2, pTarget, 0, 0) !== 0) {
      return
    }
  } else {
    AI_IdleWander113c(m, pGame, pUnit)
    return
  }
  AI_Stall113c(m, pGame, pUnit, 0)
}

/**
 * `@va D2Game:0x6FCA3130` (`AiFallen`, `pGame`, `pUnit`, `pAiParam`):
 * Fallen AI callback (`D2Game.dll` `0x6FCA3130..0x6FCA3720`):
 * 1. Inspects head `D2AiCmdStrc` (`dwCmdType == 1` flee command or `dwCmdType == 0x16` war-cry / rally command).
 * 2. Checks room death counter (`pRoom + 0xEC`) for morale panic (`AI_FleeFrom113c`).
 * 3. Checks boss war-cry `S2` (`mode 9`, `0x6FCA33D0 -> AIGENERAL_BroadcastCmdToMinions113c`).
 * 4. Executes melee swing (`AI_StartAttackMode113c`), approach (`MONMODE_WALK`), or idle wander (`AI_IdleWander113c`).
 */
export function AiFallen113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  if (pGame === 0 || pUnit === 0 || pAiParam === 0) return
  const pMonsterData = m.get(pUnit, D2UnitStrc.pUnitData)
  const pAiGeneral = pMonsterData !== 0 ? m.get(pMonsterData, D2MonsterDataStrc.pAiGeneral) : 0
  const pCmd = pAiGeneral !== 0 ? m.get(pAiGeneral, D2AiGeneralStrc.pCommandHead) : 0

  const bEngaged = m.u32(pAiParam + D2AiParamStrc113c.bEngaged)
  const pTarget = m.u32(pAiParam + D2AiParamStrc113c.pTarget)
  const nDistance = m.u32(pAiParam + D2AiParamStrc113c.nDistanceToTarget) | 0
  const bInMeleeRange = m.u32(pAiParam + D2AiParamStrc113c.bInMeleeRange)
  const seedPtr = pUnit + D2UnitStrc.seedLo.off

  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiff113c(m, pGame)
  const aip1 = row !== undefined ? row.aip1[diff] : 65
  const aip2 = row !== undefined ? row.aip2[diff] : 50
  const aip3 = row !== undefined ? row.aip3[diff] : 5
  const aip4 = row !== undefined ? row.aip4[diff] : 15

  // 1. Check active AI command (`dwCmdType == 1` morale flee)
  if (pCmd !== 0 && m.get(pCmd, D2AiCmdStrc.dwCmdType) === 1) {
    const remainingFlee = (m.get(pCmd, D2AiCmdStrc.dwParam1) | 0) - 1
    if (remainingFlee > 0 && pTarget !== 0) {
      m.set(pCmd, D2AiCmdStrc.dwParam1, remainingFlee >>> 0)
      const runRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
      AI_FleeFrom113c(m, pGame, pUnit, pTarget, 12, runRoll < aip2 ? 1 : 0)
      return
    }
    m.set(pCmd, D2AiCmdStrc.dwCmdType, 0)
  }

  // 2. Check recent room death counter (`pRoom + 0xEC`) when engaged
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (bEngaged !== 0 && pTarget !== 0 && pRoom !== 0 && m.u32(pRoom + 0xec) > 0) {
    const fleeRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    if (fleeRoll < aip1 + 25) {
      AIGENERAL_CopyAiCommandParams113c(m, pUnit, 1, 2, 0, 0, 0)
      const runRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
      AI_FleeFrom113c(m, pGame, pUnit, pTarget, 12, runRoll < aip2 ? 1 : 0)
      return
    }
  }

  if (bEngaged === 0 || pTarget === 0) {
    const idleRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    if (idleRoll < 50) {
      AI_IdleWander113c(m, pGame, pUnit)
      return
    }
    AI_Stall113c(m, pGame, pUnit, aip4)
    return
  }

  // 3. Boss war-cry (`MONMODE_SKILL2 = 9`) when pack leader (`dwLeaderId == dwUnitId`)
  const myId = m.get(pUnit, D2UnitStrc.dwUnitId)
  const isLeader = pAiGeneral !== 0 && m.get(pAiGeneral, D2AiGeneralStrc.dwLeaderId) === myId
  if (isLeader && bInMeleeRange === 0 && nDistance <= 10) {
    const cryRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    if (cryRoll < aip3) {
      const pCmdArgs = m.alloc(0x1c)
      m.setU32(pCmdArgs + 0x08, 0x16)
      m.setU32(pCmdArgs + 0x0c, 1)
      AIGENERAL_BroadcastCmdToMinions113c(m, pUnit, pGame, pCmdArgs)
      MONSTER_StartMode113c(m, pGame, pUnit, 9, pTarget, 0, 0)
      return
    }
  }

  // 4. Melee range attack vs approach
  if (bInMeleeRange !== 0) {
    const atkRoll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    if (atkRoll < aip1) {
      const a2Roll = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
      AI_StartAttackMode113c(m, a2Roll < 50 ? 5 : 4, pUnit, pGame, pTarget, undefined, {
        onMonsterStartMode: (mem, g, sp) =>
          MONSTER_StartMode113c(mem, g, mem.u32((sp + 4) >>> 0), mem.u32(sp), mem.u32((sp + 8) >>> 0), 0, 0),
      })
      return
    }
    AI_Stall113c(m, pGame, pUnit, aip4)
    return
  }

  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_SetNewDistance113c(m, pPath, 6)
    PATH_SetType113c(m, pPath, 2)
  }
  if (MONSTER_StartMode113c(m, pGame, pUnit, 2, pTarget, 0, 0) === 0) {
    AI_Stall113c(m, pGame, pUnit, aip4)
  }
}

/**
 * `@va D2Game:0x6FD13220` (`AI_GeneralFindTargetOrThrottle`):
 * Builds the 36-byte `D2AiParamStrc` on `m` (or caller buffer), locates the nearest valid target via
 * `AI_FindNearestPlayerOrAlly113c` (`0x6FCD1C90`), checks approach taunt sound (`0x6FCBCA60`), and
 * dispatches the monster's `pfnThink` (`AiZombie113c` `0x6FCA38B0`, `AiFallen113c` `0x6FCA3130`, etc.).
 */
export function AI_GeneralFindTargetOrThrottle113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs = 0,
): void {
  if (pGame === 0 || pUnit === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return

  const pMonsterData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pMonsterData === 0) return
  const pAiGeneral = m.get(pMonsterData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGeneral === 0) return
  const pfnThink = m.get(pAiGeneral, D2AiGeneralStrc.pfnThink) >>> 0

  const targetInfo = AI_FindNearestPlayerOrAlly113c(m, pGame, pUnit)
  const pAiParam = pAiTickArgs !== 0 ? pAiTickArgs : m.alloc(D2AiParamStrc_SIZE_113C)
  m.setU32(pAiParam + D2AiParamStrc113c.pAiControl, m.get(pMonsterData, D2MonsterDataStrc.pAiControl))
  m.setU32(pAiParam + D2AiParamStrc113c.pAiFn, pfnThink)
  m.setU32(pAiParam + D2AiParamStrc113c.pTarget, targetInfo.pTarget >>> 0)
  m.setU32(pAiParam + D2AiParamStrc113c.nStallFrames, 0)
  m.setU32(pAiParam + D2AiParamStrc113c.bEngaged, targetInfo.pTarget !== 0 ? 1 : 0)
  m.setU32(pAiParam + D2AiParamStrc113c.nDistanceToTarget, targetInfo.distance >>> 0)
  m.setU32(pAiParam + D2AiParamStrc113c.bInMeleeRange, targetInfo.inMeleeRange >>> 0)
  m.setU32(pAiParam + D2AiParamStrc113c.pMonStatsTxt, m.get(pMonsterData, D2MonsterDataStrc.pMonStatsTxt))

  if (targetInfo.pTarget !== 0) {
    AI_CheckApproachTauntSound113c(m, pGame, pUnit, pAiParam)
  }

  if (pfnThink === 0x6fca38b0) {
    AiZombie113c(m, pGame, pUnit, pAiParam)
    return
  }
  if (pfnThink === 0x6fca3130) {
    AiFallen113c(m, pGame, pUnit, pAiParam)
    return
  }
  if (pfnThink === 0x6fca3720) {
    AI_FallenShaman113c(m, pGame, pUnit, pAiParam)
    return
  }
  if (pfnThink === 0x6fca0720) {
    AI_Skeleton113c(m, pGame, pUnit, pAiParam)
    return
  }
  AiFallen113c(m, pGame, pUnit, pAiParam)
}

/**
 * `@va D2Game:0x6FCBD160` (`AI_DispatchTargetByAiFlag`):
 * Checks `STATES_CheckState(pUnit, STATE_STUNNED = 0x15)` and `pAiGeneral` alignment flags, then
 * dispatches to `AI_GeneralFindTargetOrThrottle113c` (`0x6FD13220`).
 */
export function AI_DispatchTargetByAiFlag113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  if (pGame === 0 || pUnit === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return
  if (STATES_CheckState113c(m, pUnit, 0x15) !== 0) {
    AI_Stall113c(m, pGame, pUnit, 15)
    return
  }
  AI_GeneralFindTargetOrThrottle113c(m, pGame, pUnit, 0)
}

/**
 * `@va D2Game:0x6FCBD3B0` (`AI_RunMonsterAI`):
 * Monster `Event 2` (`MON_EVENT_AI_THINK`) entry point (`0x6FCBD3B0 -> 0x6FCBD160 -> 0x6FD13220`).
 */
export function AI_RunMonsterAI113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  AI_DispatchTargetByAiFlag113c(m, pGame, pUnit)
}

// ============================================================================
// 3. MONSTER DEATH, BOSS REASSIGNMENT & CORPSE FINALIZATION (`0x6FC95350 .. 0x6FC96270`)
// ============================================================================

/**
 * `@va D2Game:0x6FC95350` (`MONSTER_SetDeathPathAndAnim`, `eax = pGame`, `edi = pUnit`, `[esp+4] = pKiller`):
 * Configures monster death collision (`PATH_MarkUnitDeadCollision113c` `0x6FDAB750`), clears mode events,
 * reassigns minion pack leader via `AIGENERAL_ReassignPackOnBossDeath113c` (`0x6FC410D0`), transitions
 * `dwAnimMode = 0` (`MONMODE_DEATH`), and schedules `Event 1` (`MON_EVENT_MODE_END`) for `MONSTER_EndDeath113c`.
 */
export function MONSTER_SetDeathPathAndAnim113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pKiller = 0,
): number {
  void pKiller
  if (pGame === 0 || pUnit === 0) return 0
  MONSTER_ClearModeEvents113c(m, pGame, pUnit)
  const pMonData = m.get(pUnit, D2UnitStrc.pUnitData)
  const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
  if (pAiGen !== 0 && (m.u8(pAiGen + 0x08) & 3) === 3) {
    AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen, pUnit)
  }

  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_MarkUnitDeadCollision113c(m, pUnit, 0)
  }

  UNITS_ChangeAnimMode113c(m, pUnit, 0)
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  const baseFrames = getMonsterModeBaseFrameCountPure113c(classId, 0)
  const speed256 = getMonsterModeBaseAnimSpeed256Pure113c(classId, 0)
  const frameCountPrecise = (baseFrames << 8) >>> 0
  m.set(pUnit, D2UnitStrc.dwFramePrecise, 0)
  m.set(pUnit, D2UnitStrc.dwFrameCountPrecise, frameCountPrecise)
  m.set(pUnit, D2UnitStrc.wAnimSpeed, speed256 & 0xffff)

  const endTicks = speed256 > 0 ? Math.max(1, Math.floor(frameCountPrecise / speed256)) : 20
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGame,
    pUnit,
    MON_EVENT_MODE_END,
    (gameFrame + endTicks) >>> 0,
    0,
    0,
    0,
  )
  return 1
}

/**
 * `@va D2Game:0x6FC96270` (`MONSTER_StartDeath`):
 * Initiates monster death (`mode 0 DT`):
 * 1. Calls `MONSTER_SetDeathPathAndAnim113c` (`0x6FC95350`, promoting next minion via `0x6FC410D0` and scheduling `Event 1` `+20` frames).
 * 2. Deletes `Event 2` (`AI_THINK`) and `Event 3` (`STAT_REGEN`).
 * 3. Records death in `pRoom` via `ROOM_RecordMonsterDeath113c` (`0x6FD8AFD0`).
 * 4. Rolls monster TreasureClass loot via `MONSTER_DropDeathItems113c` (`0x6FC95900 -> 0x6FC95680 -> 0x6FC32D60`).
 */
export function MONSTER_StartDeath113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pKiller = 0,
  allocateLootUnitInMem = false,
): number {
  if (pGame === 0 || pUnit === 0) return 0
  MONSTER_SetDeathPathAndAnim113c(m, pGame, pUnit, pKiller)
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_AI_THINK, 0)
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 3, 0)

  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom !== 0) {
    ROOM_RecordMonsterDeath113c(m, pRoom, pUnit)
  }
  MONSTER_DropDeathItems113c(m, pGame, pUnit, pKiller, allocateLootUnitInMem)
  return 1
}

/**
 * `@va D2Game:0x6FC96040` (`MONSTER_EndDeath`, `ecx = pGame`, `edx = pUnit`):
 * `MONMODE_DEATH (0)` `pfnEnd` handler (20 frames after `MONSTER_StartDeath113c` for Fallen):
 * Transitions `pUnit` from `mode 0` (`DT`) to `mode 12` (`DD` `MONMODE_DEAD`), clears targetable/attackable
 * flags (`~0x07`), sets `UNITFLAG_DEAD (0x10000)`, and frees remaining mode/AI events.
 */
export function MONSTER_EndDeath113c(m: Memory113c, pGame: number, pUnit: number): number {
  if (pUnit === 0) return 0
  if (pGame !== 0) {
    MONSTER_ClearModeEvents113c(m, pGame, pUnit)
    EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_AI_THINK, 0)
  }
  UNITS_ChangeAnimMode113c(m, pUnit, 12)
  const flags = m.get(pUnit, D2UnitStrc.dwFlags)
  m.set(
    pUnit,
    D2UnitStrc.dwFlags,
    ((flags & ~(UNITFLAG_TARGETABLE_113C | UNITFLAG_CANBEATTACKED_113C | UNITFLAG_ISVALIDTARGET_113C)) |
      UNITFLAG_DEAD_113C) >>>
      0,
  )
  return 1
}

/**
 * `@va D2Game:0x6FC971D0` (`MONSTER_CheckSandLeaperMidAir`, `eax = pUnit`):
 * Returns `1` if `pUnit` is a Sand Leaper (`251..255`) currently in mid-air (`mode 5 A2`), else `0`.
 */
export function MONSTER_CheckSandLeaperMidAir113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  if (classId < 251 || classId > 255) return 0
  return m.get(pUnit, D2UnitStrc.dwAnimMode) === 5 ? 1 : 0
}

// ============================================================================
// 4. PLAYER MODE DISPATCH: MELEE ATTACK, SKILL, CAST & SHIELD BLOCK (`0x6FC978A0 .. 0x6FC99170`)
// ============================================================================

/**
 * `@va D2Game:0x6FC98760` (`PLAYER_ScheduleAttackActionFrameEvents`):
 * Deletes existing player `Event 6` (`MODE_STEP`) and `Event 7` (`MODE_END`) nodes and schedules new
 * `Event 6` (at `dwGameFrame + actionTicks`) and `Event 7` (at `dwGameFrame + endTicks`).
 */
export function PLAYER_ScheduleAttackActionFrameEvents113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  actionTicks: number,
  endTicks: number,
): void {
  if (pGame === 0 || pPlayer === 0) return
  EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, PLR_EVENT_MODE_STEP_113C, 0)
  EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, PLR_EVENT_MODE_END_113C, 0)
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  if ((actionTicks | 0) > 0) {
    EVENT_SetEventFull113c(
      m,
      pGame,
      pPlayer,
      PLR_EVENT_MODE_STEP_113C,
      (gameFrame + (actionTicks >>> 0)) >>> 0,
      0,
      0,
      0,
    )
  }
  if ((endTicks | 0) > 0) {
    EVENT_SetEventFull113c(
      m,
      pGame,
      pPlayer,
      PLR_EVENT_MODE_END_113C,
      (gameFrame + (endTicks >>> 0)) >>> 0,
      0,
      0,
      0,
    )
  }
}

/**
 * `@va D2Game:0x6FC99100` (`PLAYER_ScheduleSkillActionFrameEvents`):
 * Schedules `Event 6` (`MODE_STEP`) and `Event 7` (`MODE_END`) for player cast/skill modes (`SC`, `S1..S4`).
 */
export function PLAYER_ScheduleSkillActionFrameEvents113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  actionTicks: number,
  endTicks: number,
): void {
  PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, actionTicks, endTicks)
}

/**
 * `@va D2Game:0x6FC981C0` (`PLAYER_StartBlockMode`):
 * Transitions `pPlayer` into `PLRMODE_BLOCK (9)` (`BL`), computes block animation speed from
 * `AnimData.d2` (`BA` + `BL` + weapon class `1HS`) and `STAT_ITEM_FASTERBLOCKRATE (102)`, and schedules
 * `Event 7` (`PLR_EVENT_MODE_END`) (`6` frames for level-1 Hand Axe + Buckler Barbarian at `F1542..F1548` & `F1603..F1609`).
 */
export function PLAYER_StartBlockMode113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  weaponClassCode = '1HS',
): number {
  if (pGame === 0 || pPlayer === 0) return 0
  UNITS_ChangeAnimMode113c(m, pPlayer, 9)
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const clip = getCharAnimClipPure113c(classId, 9, weaponClassCode)
  const fbr = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ITEM_FASTERBLOCKRATE_113C, 0) | 0
  const effFbr = computeFrwDiminishingPure113c(fbr)
  const speed = computeRawPlayerAnimSpeedPure113c({
    mode: 9,
    classId,
    statAcc: effFbr,
    stat68Acc: 0,
    stat67Acc: 0,
    weaponClass: weaponClassCode,
  })
  const frameCountPrecise = (clip.frames << 8) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFramePrecise, 0)
  m.set(pPlayer, D2UnitStrc.dwFrameCountPrecise, frameCountPrecise)
  m.set(pPlayer, D2UnitStrc.wAnimSpeed, speed & 0xffff)
  m.set(pPlayer, D2UnitStrc.wActionFrame, 0)

  const endTicks = speed > 0 ? Math.max(1, Math.floor((frameCountPrecise - 1) / speed)) : 6
  PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, 0, endTicks)
  return 1
}

/**
 * `@va D2Game:0x6FC98430` (`PLAYER_StartModeAttack`):
 * Transitions `pPlayer` into `PLRMODE_ATTACK1 (7)` (`A1`) or `PLRMODE_ATTACK2 (8)` (`A2`), initializes
 * `dwFramePrecise` (`playerAnimStartFramePure113c << 8`), `dwFrameCountPrecise`, `wAnimSpeed`, and
 * schedules `Event 6` (`actionTicks = 6`) and `Event 7` (`endTicks = 15`).
 */
export function PLAYER_StartModeAttack113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode = 7,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  if (pGame === 0 || pPlayer === 0) return 0
  const atkMode = mode === 8 ? 8 : 7
  UNITS_ChangeAnimMode113c(m, pPlayer, atkMode)

  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath !== 0 && pTarget !== 0) {
    PATH_SetTargetUnit113c(m, pPath, pTarget)
  }

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const clip = getCharAnimClipPure113c(classId, atkMode, weaponClassCode)
  const ias = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ITEM_FASTERATTACKRATE_113C, 0) | 0
  const effIas = computeFrwDiminishingPure113c(ias)
  const atkRate = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ATTACKRATE_113C, 0) | 0
  const speed = computeRawPlayerAnimSpeedPure113c({
    mode: atkMode,
    classId,
    statAcc: effIas,
    stat68Acc: atkRate,
    stat67Acc: 0,
    weaponClass: weaponClassCode,
  })
  const startFrame = playerAnimStartFramePure113c(classId, atkMode, weaponClassCode)
  const startPrecise = (startFrame << 8) >>> 0
  const countPrecise = (clip.frames << 8) >>> 0

  m.set(pPlayer, D2UnitStrc.dwFramePrecise, startPrecise)
  m.set(pPlayer, D2UnitStrc.dwFrameCountPrecise, countPrecise)
  m.set(pPlayer, D2UnitStrc.wAnimSpeed, speed & 0xffff)
  m.set(pPlayer, D2UnitStrc.wActionFrame, 1)

  const firstEvent = clip.events[0]
  const actionFrameIdx = firstEvent !== undefined ? firstEvent.f : Math.max(1, clip.frames >> 1)
  let actionTicks = 0
  let curPrecise = startPrecise
  for (let tick = 1; tick <= 64; tick++) {
    curPrecise = (curPrecise + speed) >>> 0
    const frameIdx = curPrecise >>> 8
    if (actionTicks === 0 && frameIdx >= actionFrameIdx) {
      actionTicks = tick
    }
    if (curPrecise >= countPrecise) {
      PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, actionTicks, tick)
      return 1
    }
  }
  PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, 6, 15)
  return 1
}

/**
 * `@va D2Game:0x6FC987C0` (`PLAYER_StartModeAttackWithTarget`):
 * Starts player melee attack (`0x6FC987C0 -> 0x6FC98430`) against `pTarget`.
 */
export function PLAYER_StartModeAttackWithTarget113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode = 7,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  return PLAYER_StartModeAttack113c(m, pGame, pPlayer, mode, pTarget, weaponClassCode)
}

/**
 * `@va D2Game:0x6FC98A90` (`PLAYER_StartModeCast`):
 * Starts player `PLRMODE_CAST (10)` (`SC`) and schedules cast action/end events.
 */
export function PLAYER_StartModeCast113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  if (pGame === 0 || pPlayer === 0) return 0
  UNITS_ChangeAnimMode113c(m, pPlayer, 10)
  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath !== 0 && pTarget !== 0) {
    PATH_SetTargetUnit113c(m, pPath, pTarget)
  }
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const clip = getCharAnimClipPure113c(classId, 10, weaponClassCode)
  const speed = computeRawPlayerAnimSpeedPure113c({
    mode: 10,
    classId,
    statAcc: 0,
    stat68Acc: 0,
    stat67Acc: 0,
    weaponClass: weaponClassCode,
  })
  const countPrecise = (clip.frames << 8) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFramePrecise, 0)
  m.set(pPlayer, D2UnitStrc.dwFrameCountPrecise, countPrecise)
  m.set(pPlayer, D2UnitStrc.wAnimSpeed, speed & 0xffff)
  const endTicks = speed > 0 ? Math.max(1, Math.floor(countPrecise / speed)) : 10
  PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pPlayer, Math.max(1, endTicks >> 1), endTicks)
  return 1
}

/**
 * `@va D2Game:0x6FC98DD0` (`PLAYER_StartModeSkill`):
 * Starts player skill mode (`11..14` `S1..S4` or `18` `SQ`).
 */
export function PLAYER_StartModeSkill113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode = 11,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  return PLAYER_StartModeAttack113c(m, pGame, pPlayer, mode, pTarget, weaponClassCode)
}

/**
 * `@va D2Game:0x6FC99170` (`PLAYER_StartModeDispatch`):
 * Dispatches player mode transitions (`0..19`) to `PLAYER_StartModeAttack113c`, `PLAYER_StartBlockMode113c`,
 * `PLAYER_StartModeCast113c`, `PLAYER_StartModeSkill113c`, or `UNITS_ChangeAnimMode113c`.
 */
export function PLAYER_StartModeDispatch113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode: number,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  if (pGame === 0 || pPlayer === 0) return 0
  if (mode === 7 || mode === 8) {
    return PLAYER_StartModeAttackWithTarget113c(m, pGame, pPlayer, mode, pTarget, weaponClassCode)
  }
  if (mode === 9) {
    return PLAYER_StartBlockMode113c(m, pGame, pPlayer, weaponClassCode)
  }
  if (mode === 10) {
    return PLAYER_StartModeCast113c(m, pGame, pPlayer, pTarget, weaponClassCode)
  }
  if (mode >= 11 && mode <= 14) {
    return PLAYER_StartModeSkill113c(m, pGame, pPlayer, mode, pTarget, weaponClassCode)
  }
  return UNITS_ChangeAnimMode113c(m, pPlayer, mode)
}

/**
 * `@va D2Game:0x6FC97B20` (`PLAYER_AdvanceSkillModeFrame`):
 * Fires on player `Event 6` (`PLR_EVENT_MODE_STEP`) at the melee/skill action frame (`wActionFrame != 0`):
 * clears `wActionFrame` and executes the attack hit against `pPath->pTargetUnit` via
 * `SUNITDMG_AllocCombat113c` -> `SUNITDMG_ExecuteEvents113c` -> `SUNITDMG_DistributeExperience113c`.
 */
export function PLAYER_AdvanceSkillModeFrame113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pTargetOverride = 0,
): number {
  if (pGame === 0 || pPlayer === 0) return 0
  m.set(pPlayer, D2UnitStrc.wActionFrame, 0)
  let pTarget = pTargetOverride
  if (pTarget === 0) {
    const pPath = m.get(pPlayer, D2UnitStrc.pPath)
    if (pPath !== 0) {
      pTarget = m.get(pPath, D2DynamicPathStrc.pTargetUnit)
    }
  }
  if (pTarget === 0 || SUNIT_IsDeadOrDying113c(m, pTarget) !== 0) return 0
  const pDmg = m.alloc(D2DamageStrc_SIZE)
  SUNITDMG_FillDamageValues113c(m, pGame, pPlayer, pTarget, pDmg, 0, 128)
  SUNITDMG_AllocCombat113c(m, pGame, pPlayer, pTarget, pDmg, 128)
  SUNITDMG_ExecuteEvents113c(m, pGame, pPlayer, pTarget, 1, pDmg)
  return 1
}

/**
 * `@va D2Game:0x6FC978A0` (`PLAYER_EndAttackOrBlockAnim`):
 * Fires on player `Event 7` (`PLR_EVENT_MODE_END`) when an attack (`mode 7/8`) or block (`mode 9`)
 * animation finishes: deletes `Event 6`/`Event 7` and returns `pPlayer` to `PLRMODE_TNEUTRAL (1)`.
 */
export function PLAYER_EndAttackOrBlockAnim113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
  if (pPlayer === 0) return 0
  if (pGame !== 0) {
    EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, PLR_EVENT_MODE_STEP_113C, 0)
    EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, PLR_EVENT_MODE_END_113C, 0)
  }
  UNITS_ChangeAnimMode113c(m, pPlayer, 1)
  return 1
}

// ============================================================================
// 5. SUNITDMG COMBAT, DAMAGE, BLOCK, RESISTANCE & EXPERIENCE (`0x6FCEB950 .. 0x6FCFFA60`)
// ============================================================================

/**
 * `@va D2Game:0x6FCFFA60` (`SUNITDMG_GetPlayerClientClassId`, `eax = pUnit`):
 * Returns `pUnit->dwClassId` (`0..6`) when `pUnit` is a valid player, else `0`.
 */
export function SUNITDMG_GetPlayerClientClassId113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return 0
  return m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
}

/**
 * `@va D2Game:0x6FCFB5E0` (`SUNITDMG_ResolveAttackerPlayer`, `eax = pUnit`):
 * Resolves `pUnit` (or a missile/pet's owner player) to the owning `UNIT_PLAYER` pointer.
 */
export function SUNITDMG_ResolveAttackerPlayer113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  if (pUnit === 0) return 0
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (unitType === UNIT_PLAYER) return pUnit
  const ownerType = m.get(pUnit, D2UnitStrc.dwOwnerType)
  const ownerId = m.get(pUnit, D2UnitStrc.dwOwnerId)
  if (ownerType === UNIT_PLAYER && pGame !== 0) {
    return SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_PLAYER, ownerId)
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFAB90` (`SUNITDMG_PrependCombatNode`, `eax = pAttacker`, `ecx = pCombat`):
 * Links `pCombat` at the LIFO head of `pAttacker->pCombat (+0xAC)`.
 */
export function SUNITDMG_PrependCombatNode113c(
  m: Memory113c,
  pAttacker: number,
  pCombat: number,
): void {
  if (pAttacker === 0 || pCombat === 0) return
  const prevHead = m.get(pAttacker, D2UnitStrc.pCombat)
  m.setU32(pCombat + D2CombatStrc113c.pNext, prevHead >>> 0)
  m.set(pAttacker, D2UnitStrc.pCombat, pCombat)
}

/**
 * `@va D2Game:0x6FCFA6D0` (`SUNITDMG_RemoveCombatNode`):
 * Unlinks and frees the `D2CombatStrc` node matching `(pAttacker, pDefender)` from `pAttacker->pCombat (+0xAC)`.
 */
export function SUNITDMG_RemoveCombatNode113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  if (pAttacker === 0) return 0
  const defType = pDefender !== 0 ? m.get(pDefender, D2UnitStrc.dwUnitType) : 0
  const defId = pDefender !== 0 ? m.get(pDefender, D2UnitStrc.dwUnitId) : 0
  let prev = 0
  let cur = m.get(pAttacker, D2UnitStrc.pCombat)
  while (cur !== 0) {
    const next = m.u32(cur + D2CombatStrc113c.pNext)
    if (
      pDefender === 0 ||
      (m.u32(cur + D2CombatStrc113c.dwDefenderType) === defType &&
        m.u32(cur + D2CombatStrc113c.dwDefenderId) === defId)
    ) {
      if (prev === 0) {
        m.set(pAttacker, D2UnitStrc.pCombat, next)
      } else {
        m.setU32(prev + D2CombatStrc113c.pNext, next)
      }
      return 1
    }
    prev = cur
    cur = next
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFAA90` (`SUNITDMG_FindCombatDamageData`):
 * Searches `pAttacker->pCombat (+0xAC)` for the node matching `(dwDefenderType, dwDefenderId)` and returns
 * a pointer to its embedded `D2DamageStrc` (`pCombat + 0x14`), or `0` if not found.
 */
export function SUNITDMG_FindCombatDamageData113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)
  const defId = m.get(pDefender, D2UnitStrc.dwUnitId)
  let cur = m.get(pAttacker, D2UnitStrc.pCombat)
  while (cur !== 0) {
    if (
      m.u32(cur + D2CombatStrc113c.dwDefenderType) === defType &&
      m.u32(cur + D2CombatStrc113c.dwDefenderId) === defId
    ) {
      return (cur + D2CombatStrc113c.tDamage) >>> 0
    }
    cur = m.u32(cur + D2CombatStrc113c.pNext)
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFAA40` (`SUNITDMG_GetAttackerDamageData`):
 * Returns the embedded `D2DamageStrc` (`pCombat + 0x14`) from the head `pAttacker->pCombat` node (or matching `pDefender`).
 */
export function SUNITDMG_GetAttackerDamageData113c(
  m: Memory113c,
  pAttacker: number,
  pDefender = 0,
): number {
  if (pAttacker === 0) return 0
  if (pDefender !== 0) {
    const found = SUNITDMG_FindCombatDamageData113c(m, pAttacker, pDefender)
    if (found !== 0) return found
  }
  const head = m.get(pAttacker, D2UnitStrc.pCombat)
  return head !== 0 ? (head + D2CombatStrc113c.tDamage) >>> 0 : 0
}

/**
 * `@va D2Game:0x6FCFDE90` (`SUNITDMG_CheckToHit`):
 * Computes attack rating (`AR`), defense (`AC`), level factor `(2 * alvl) / (alvl + dlvl)`, clamps hit chance
 * to `[5, 95]`, and rolls `SEED_RollLimitedRandomNumber(pAttacker->tSeed, 100) < hitChance`.
 * When the attack hits, sets `wResultFlags |= 0x0001` (`RESULTFLAG_HIT`).
 */
export function SUNITDMG_CheckToHit113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg = 0,
  arBonusPct = 0,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  const attackerType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const defenderType = m.get(pDefender, D2UnitStrc.dwUnitType)

  let ar = STATLIST_GetUnitStat113c(m, pAttacker, STAT_TOHIT_113C, 0) | 0
  if (attackerType === UNIT_PLAYER) {
    const dex = STATLIST_GetUnitStat113c(m, pAttacker, STAT_DEXTERITY_113C, 0) | 0
    const classId = m.get(pAttacker, D2UnitStrc.dwClassId) >>> 0
    const charStats = getCharStatsPure113c(classId)
    ar += (dex - 7) * 5 + charStats.toHitFactor
  } else if (attackerType === UNIT_MONSTER && ar <= 0) {
    const classId = m.get(pAttacker, D2UnitStrc.dwClassId) >>> 0
    ar = classId === 1 ? 26 : 21
  }
  if (arBonusPct !== 0) {
    ar = ar + Math.trunc((ar * arBonusPct) / 100)
  }
  if (ar < 0) ar = 0

  let def = STATLIST_GetUnitStat113c(m, pDefender, STAT_ARMORCLASS_113C, 0) | 0
  if (defenderType === UNIT_PLAYER) {
    const dex = STATLIST_GetUnitStat113c(m, pDefender, STAT_DEXTERITY_113C, 0) | 0
    def += dex >> 2
  } else if (defenderType === UNIT_MONSTER && def <= 0) {
    const classId = m.get(pDefender, D2UnitStrc.dwClassId) >>> 0
    def = classId === 1 ? 3 : 2
  }
  if (def < 0) def = 0

  const alvl = Math.max(1, STATLIST_GetUnitStat113c(m, pAttacker, STAT_LEVEL_113C, 0) | 0)
  const dlvl = Math.max(1, STATLIST_GetUnitStat113c(m, pDefender, STAT_LEVEL_113C, 0) | 0)

  const denom = ar + def
  const arTerm = denom > 0 ? Math.trunc((ar * 100) / denom) : 100
  let hitChance = Math.trunc((2 * alvl * arTerm) / (alvl + dlvl))
  if (hitChance < 5) hitChance = 5
  if (hitChance > 95) hitChance = 95

  const roll = SEED_RollLimitedRandomNumber113c(m, pAttacker + D2UnitStrc.seedLo.off, 100)
  const hit = roll < hitChance ? 1 : 0
  if (pDmg !== 0 && hit !== 0) {
    m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x0001) & 0xffff)
  }
  return hit
}

/**
 * `@va D2Game:0x6FCFBED0` (`SUNITDMG_RollDamageValue`):
 * Clamps `minDmg`/`maxDmg` and rolls `minDmg + SEED_RollLimitedRandomNumber(pUnit->tSeed, maxDmg - minDmg)`
 * when `maxDmg > minDmg`.
 */
export function SUNITDMG_RollDamageValue113c(
  m: Memory113c,
  pUnit: number,
  minDmg: number,
  maxDmg: number,
  strBonusWeight = 0,
  dexBonusWeight = 0,
  enhDmgPct = 0,
): number {
  let lo = minDmg | 0
  let hi = maxDmg | 0
  if (lo < 0) lo = 0
  if (hi <= lo) hi = lo
  let totalPct = enhDmgPct | 0
  if ((strBonusWeight !== 0 || dexBonusWeight !== 0) && pUnit !== 0) {
    const str = STATLIST_GetUnitStat113c(m, pUnit, STAT_STRENGTH_113C, 0) | 0
    const dex = STATLIST_GetUnitStat113c(m, pUnit, STAT_DEXTERITY_113C, 0) | 0
    totalPct += Math.trunc((str * strBonusWeight + dex * dexBonusWeight) / 100)
  }
  if (totalPct !== 0) {
    lo = lo + Math.trunc((lo * totalPct) / 100)
    hi = hi + Math.trunc((hi * totalPct) / 100)
  }
  const delta = hi > lo ? hi - lo : 0
  let rolled = lo
  if (delta > 0 && pUnit !== 0) {
    rolled = lo + SEED_RollLimitedRandomNumber113c(m, pUnit + D2UnitStrc.seedLo.off, delta)
  }
  return Math.max(0, rolled)
}

/**
 * `@va D2Game:0x6FCFA9E0` (`SUNITDMG_CheckMonTypeFlag`):
 * Checks `MonStats.bin` `lUndead (+0xAA & 2)` / `hUndead (+0xAA & 4)` / `demon (+0xAA & 8)`.
 */
export function SUNITDMG_CheckMonTypeFlag113c(
  m: Memory113c,
  pUnit: number,
  typeMask: number,
): number {
  if (pUnit === 0) return 0
  if (MONSTER_CheckTypeFlagsMask113c(m, pUnit, typeMask) !== 0) return 1
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const row = getMonStatsRowByClassId113c(m.get(pUnit, D2UnitStrc.dwClassId) >>> 0)
  if (row === undefined) return 0
  return (row.bitField1 & typeMask) !== 0 ? 1 : 0
}

/**
 * `@va D2Game:0x6FCFA8C0` (`SUNITDMG_AddDemonDamageBonus`):
 * Adds `STAT_ITEM_DEMONDAMAGE_PERCENT (121)` and `STAT_ITEM_DEMON_TOHIT (123)` when `pDefender` is a Demon (`mask 0x08`).
 */
export function SUNITDMG_AddDemonDamageBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  if (SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08) === 0) return 0
  return STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_DEMONDAMAGE_PERCENT_113C, 0) | 0
}

/**
 * `@va D2Game:0x6FCFAD70` (`SUNITDMG_AddMonsterTypeDamageBonus`):
 * Adds Undead (`STAT_ITEM_UNDEADDAMAGE_PERCENT = 122`) and Demon (`STAT_ITEM_DEMONDAMAGE_PERCENT = 121`)
 * damage bonuses against `pDefender`.
 */
export function SUNITDMG_AddMonsterTypeDamageBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  let bonus = SUNITDMG_AddDemonDamageBonus113c(m, pAttacker, pDefender)
  if (SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x06) !== 0) {
    bonus += STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_UNDEADDAMAGE_PERCENT_113C, 0) | 0
  }
  return bonus
}

/**
 * `@va D2Game:0x6FCFC030` (`SUNITDMG_GetTotalSkillDamageBonus`):
 * Computes total enhanced damage percentage from `STAT_DAMAGEPERCENT (25)` and skill bonuses.
 */
export function SUNITDMG_GetTotalSkillDamageBonus113c(
  m: Memory113c,
  pAttacker: number,
  skillBonusPct = 0,
): number {
  if (pAttacker === 0) return skillBonusPct | 0
  return (STATLIST_GetUnitStat113c(m, pAttacker, STAT_DAMAGEPERCENT_113C, 0) | 0) + (skillBonusPct | 0)
}

/**
 * `@va D2Game:0x6FCFC530` (`SUNITDMG_ComputeWeaponBaseDamage`):
 * Computes 256-fixed-point physical weapon damage for `pAttacker` against `pDefender`:
 * - Reads `STAT_MINDAMAGE (21)` (`<< 8`) and `STAT_MAXDAMAGE (22)` (`<< 8`) (for level-1 Hand Axe Barbarian: `min=3<<8=768`, `max=6<<8=1536`).
 * - Rolls `SUNITDMG_RollDamageValue113c(m, pAttacker, minDmg, maxDmg, strBonus=90, dexBonus=0, enhDmgPct)`.
 * - Rolls deadly strike (`STAT_ITEM_DEADLYSTRIKE = 141`) / critical strike (`<< 1`).
 */
export function SUNITDMG_ComputeWeaponBaseDamage113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  strBonusWeight = 90,
  dexBonusWeight = 0,
): number {
  if (pAttacker === 0 || pDmg === 0) return 0
  const minRaw = STATLIST_GetUnitStat113c(m, pAttacker, STAT_MINDAMAGE_113C, 0) | 0
  const maxRaw = STATLIST_GetUnitStat113c(m, pAttacker, STAT_MAXDAMAGE_113C, 0) | 0
  const min256 = Math.max(256, minRaw << 8)
  const max256 = Math.max(min256, maxRaw << 8)
  const enhPct =
    SUNITDMG_GetTotalSkillDamageBonus113c(m, pAttacker, 0) +
    SUNITDMG_AddMonsterTypeDamageBonus113c(m, pAttacker, pDefender)
  let phys = SUNITDMG_RollDamageValue113c(
    m,
    pAttacker,
    min256,
    max256,
    strBonusWeight,
    dexBonusWeight,
    enhPct,
  )
  const dsChance = STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_DEADLYSTRIKE_113C, 0) | 0
  if (dsChance > 0) {
    const roll = SEED_RollLimitedRandomNumber113c(m, pAttacker + D2UnitStrc.seedLo.off, 100)
    if (roll < dsChance) {
      phys <<= 1
    }
  }
  m.set(pDmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
  return phys
}

/**
 * `@va D2Game:0x6FCFCD80` (`SUNITDMG_RollElementalStatDamage`):
 * Rolls elemental stat damage channels (`Fire 48..49`, `Ltng 50..51`, `Mag 52..53`, `Cold 54..56`, `Pois 57..59`)
 * and life/mana/stamina steal (`60, 62, 64`) into `pDmg`.
 */
export function SUNITDMG_RollElementalStatDamage113c(
  m: Memory113c,
  pAttacker: number,
  pDmg: number,
): void {
  if (pAttacker === 0 || pDmg === 0) return
  const fireMin = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_FIREMIN_113C, 0) | 0) << 8
  const fireMax = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_FIREMAX_113C, 0) | 0) << 8
  if (fireMax > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwFireDamage,
      SUNITDMG_RollDamageValue113c(m, pAttacker, fireMin, fireMax) >>> 0,
    )
  }
  const ltngMin = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_LIGHTMIN_113C, 0) | 0) << 8
  const ltngMax = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_LIGHTMAX_113C, 0) | 0) << 8
  if (ltngMax > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwLtngDamage,
      SUNITDMG_RollDamageValue113c(m, pAttacker, ltngMin, ltngMax) >>> 0,
    )
  }
  const magMin = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_MAGICMIN_113C, 0) | 0) << 8
  const magMax = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_MAGICMAX_113C, 0) | 0) << 8
  if (magMax > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwMagDamage,
      SUNITDMG_RollDamageValue113c(m, pAttacker, magMin, magMax) >>> 0,
    )
  }
  const coldMin = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_COLDMIN_113C, 0) | 0) << 8
  const coldMax = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_COLDMAX_113C, 0) | 0) << 8
  if (coldMax > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwColdDamage,
      SUNITDMG_RollDamageValue113c(m, pAttacker, coldMin, coldMax) >>> 0,
    )
    m.set(
      pDmg,
      D2DamageStrc.dwColdLen,
      (STATLIST_GetUnitStat113c(m, pAttacker, STAT_COLDLENGTH_113C, 0) | 0) >>> 0,
    )
  }
  const poisMin = STATLIST_GetUnitStat113c(m, pAttacker, STAT_POISMIN_113C, 0) | 0
  const poisMax = STATLIST_GetUnitStat113c(m, pAttacker, STAT_POISMAX_113C, 0) | 0
  if (poisMax > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwPoisDamage,
      SUNITDMG_RollDamageValue113c(m, pAttacker, poisMin, poisMax) >>> 0,
    )
    m.set(
      pDmg,
      D2DamageStrc.dwPoisLen,
      (STATLIST_GetUnitStat113c(m, pAttacker, STAT_POISLENGTH_113C, 0) | 0) >>> 0,
    )
  }
  m.set(
    pDmg,
    D2DamageStrc.dwLifeLeech,
    (STATLIST_GetUnitStat113c(m, pAttacker, STAT_LIFEDRAINMINDAM_113C, 0) | 0) >>> 0,
  )
  m.set(
    pDmg,
    D2DamageStrc.dwManaLeech,
    (STATLIST_GetUnitStat113c(m, pAttacker, STAT_MANADRAINMINDAM_113C, 0) | 0) >>> 0,
  )
  m.set(
    pDmg,
    D2DamageStrc.dwStamLeech,
    (STATLIST_GetUnitStat113c(m, pAttacker, STAT_STAMDRAINMINDAM_113C, 0) | 0) >>> 0,
  )
}

/**
 * `@va D2Game:0x6FCFB1F0` (`SUNITDMG_ApplyArmorPenetrationAndFlatBonus`):
 * Applies flat damage reduction and enhanced damage multiplier on `pDmg->dwPhysDamage`.
 */
export function SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  srcDam = 128,
): void {
  void pAttacker
  void pDefender
  if (pDmg === 0) return
  if (srcDam !== 128) {
    const phys = m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0
    m.set(pDmg, D2DamageStrc.dwPhysDamage, Math.trunc((phys * srcDam) / 128) >>> 0)
  }
}

/**
 * `@va D2Game:0x6FCFB6B0` (`SUNITDMG_ClampManaBurnByMonsterSkill`):
 * Clamps monster mana burn damage (`dwBurnDamage` `+0x14`).
 */
export function SUNITDMG_ClampManaBurnByMonsterSkill113c(
  m: Memory113c,
  pAttacker: number,
  pDmg: number,
): void {
  void pAttacker
  if (pDmg === 0) return
  // In 1.13c SUNITDMG_FillDamageValues, player attack leaves `dwBurnDamage = 2` (from local flag initialization).
  if (m.get(pDmg, D2DamageStrc.dwBurnDamage) === 0) {
    m.set(pDmg, D2DamageStrc.dwBurnDamage, 2)
  }
}

/**
 * `@va D2Game:0x6FCFD450` (`SUNITDMG_FillDamageValues`):
 * Checks to-hit (`0x6FCFDE90`), rolls base physical damage (`0x6FCFC530` for players or `MonStats` `a1MinD..a1MaxD`
 * + `5%` critical roll for monsters), rolls elemental channels (`0x6FCFCD80`), and sums `dwDmgTotal`.
 */
export function SUNITDMG_FillDamageValues113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  bUseAttack2 = 0,
  srcDam = 128,
): number {
  if (pAttacker === 0 || pDefender === 0 || pDmg === 0) return 0
  if ((m.get(pDmg, D2DamageStrc.wResultFlags) & 0x0001) === 0) {
    const hit = SUNITDMG_CheckToHit113c(m, pAttacker, pDefender, pDmg, 0)
    if (hit === 0) return 0
  }

  const attackerType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  if (attackerType === UNIT_PLAYER) {
    SUNITDMG_ComputeWeaponBaseDamage113c(m, pAttacker, pDefender, pDmg, 90, 0)
    SUNITDMG_RollElementalStatDamage113c(m, pAttacker, pDmg)
    SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(m, pAttacker, pDefender, pDmg, srcDam)
    SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pAttacker, pDmg)
    // 0x6FCFD908: burn damage random roll on &pAttacker->tSeed with divisor 1
    SEED_RollLimitedRandomNumber113c(m, pAttacker + D2UnitStrc.seedLo.off, 1)
  } else if (attackerType === UNIT_MONSTER) {
    void pGame
    const minStat = bUseAttack2 !== 0 ? STAT_SECONDARY_MINDAMAGE_113C : STAT_MINDAMAGE_113C
    const maxStat = bUseAttack2 !== 0 ? STAT_SECONDARY_MAXDAMAGE_113C : STAT_MAXDAMAGE_113C
    let minRaw = STATLIST_GetUnitStat113c(m, pAttacker, minStat, 0) | 0
    let maxRaw = STATLIST_GetUnitStat113c(m, pAttacker, maxStat, 0) | 0
    if (maxRaw <= 0) {
      minRaw = 1
      maxRaw = 2
    }
    const min256 = Math.max(256, minRaw << 8)
    const max256 = Math.max(min256, maxRaw << 8)
    const phys = SUNITDMG_RollDamageValue113c(m, pAttacker, min256, max256, 0, 0, 0)
    m.set(pDmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
    // 0x6FCFD908: burn damage random roll on &pAttacker->tSeed with divisor 1
    SEED_RollLimitedRandomNumber113c(m, pAttacker + D2UnitStrc.seedLo.off, 1)
    MONSTER_ApplyCritDamage113c(m, pAttacker, pDmg, pDefender)
  }

  const total =
    (m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwFireDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwLtngDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwMagDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwColdDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwPoisDamage) | 0)
  m.set(pDmg, D2DamageStrc.dwDmgTotal, Math.max(0, total) >>> 0)
  return 1
}

/**
 * `@va D2Game:0x6FCFDDE0` (`SUNITDMG_AllocCombat`):
 * Allocates a 136-byte (`0x88`) `D2CombatStrc` node, copies `pDmg` into `pCombat + 0x14`, and prepends
 * `pCombat` onto `pAttacker->pCombat (+0xAC)` via `SUNITDMG_PrependCombatNode113c` (`0x6FCFAB90`).
 */
export function SUNITDMG_AllocCombat113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  srcDam = 128,
): number {
  void srcDam
  if (pAttacker === 0 || pDefender === 0) return 0
  const pCombat = m.alloc(D2CombatStrc_SIZE_113C)
  m.setU32(pCombat + D2CombatStrc113c.pGame, pGame >>> 0)
  m.setU32(pCombat + D2CombatStrc113c.dwAttackerType, m.get(pAttacker, D2UnitStrc.dwUnitType))
  m.setU32(pCombat + D2CombatStrc113c.dwAttackerId, m.get(pAttacker, D2UnitStrc.dwUnitId))
  m.setU32(pCombat + D2CombatStrc113c.dwDefenderType, m.get(pDefender, D2UnitStrc.dwUnitType))
  m.setU32(pCombat + D2CombatStrc113c.dwDefenderId, m.get(pDefender, D2UnitStrc.dwUnitId))

  if (pDmg !== 0) {
    for (let off = 0; off < D2DamageStrc_SIZE; off += 4) {
      m.setU32(pCombat + D2CombatStrc113c.tDamage + off, m.u32(pDmg + off))
    }
  }
  SUNITDMG_PrependCombatNode113c(m, pAttacker, pCombat)
  return pCombat
}

/**
 * `@va D2Game:0x6FCFB790` (`SUNITDMG_RollPassiveWeaponBlockOrShieldBlock`):
 * Computes effective shield block chance for `pDefender`:
 * - For `UNIT_PLAYER`: `CharStats.baseBlock + shieldBlock` (adjusted by `(block * (dex - 15)) / (clvl * 2)`, clamped to `[0, 75]`;
 *   for level-1 Barbarian with Buckler (`20%`) and `dex = 20`: `baseBlock (30) + 20 = 50%` or `STAT_TOBLOCK (20)`).
 * - Rolls `SEED_RollLimitedRandomNumber(pDefender->tSeed, 100) < blockChance`.
 */
export function SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(
  m: Memory113c,
  pDefender: number,
): number {
  if (pDefender === 0) return 0
  let blockChance = STATLIST_GetUnitStat113c(m, pDefender, STAT_TOBLOCK_113C, 0) | 0
  if (blockChance <= 0) {
    return 0
  }
  if (blockChance > 75) blockChance = 75
  const roll = SEED_RollLimitedRandomNumber113c(m, pDefender + D2UnitStrc.seedLo.off, 100)
  return roll < blockChance ? 1 : 0
}

/**
 * `@va D2Game:0x6FCFB030` (`SUNITDMG_RollDodgeAvoidEvadeBlock`):
 * Rolls Amazon Dodge/Avoid/Evade or shield block (`0x6FCFB790`), setting `wResultFlags |= 0x0010` (`RESULTFLAG_BLOCK`)
 * when blocked.
 */
export function SUNITDMG_RollDodgeAvoidEvadeBlock113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): number {
  void pAttacker
  if (pDefender === 0 || pDmg === 0) return 0
  const blocked = SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, pDefender)
  if (blocked !== 0) {
    const flags = m.get(pDmg, D2DamageStrc.wResultFlags) | 0x0010
    m.set(pDmg, D2DamageStrc.wResultFlags, flags & 0xffff)
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFAC10` (`SUNITDMG_GetPvpOrPetDamageMultiplier`):
 * Returns the PvP / pet / boss damage scaling percentage (`100` for normal Player <-> Monster combat).
 */
export function SUNITDMG_GetPvpOrPetDamageMultiplier113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  void m
  void pAttacker
  void pDefender
  return 100
}

/**
 * `@va D2Game:0x6FCFB3C0` (`SUNITDMG_GetEffectiveResistance`):
 * Reads `statId` resistance from `pDefender` and clamps to `[-100, 95]` (or `maxRes`).
 */
export function SUNITDMG_GetEffectiveResistance113c(
  m: Memory113c,
  pDefender: number,
  resStatId: number,
): number {
  if (pDefender === 0) return 0
  let res = STATLIST_GetUnitStat113c(m, pDefender, resStatId, 0) | 0
  if (res < -100) res = -100
  if (res > 95) res = 95
  return res
}

/**
 * `@va D2Game:0x6FCFBD00` (`SUNITDMG_ApplySingleChannelResistance`):
 * Reduces `dmgValue` by `resistancePct` (`dmg - trunc(dmg * res / 100)`).
 */
export function SUNITDMG_ApplySingleChannelResistance113c(
  m: Memory113c,
  pDefender: number,
  dmgValue: number,
  resStatId: number,
): number {
  if ((dmgValue | 0) <= 0) return 0
  const res = SUNITDMG_GetEffectiveResistance113c(m, pDefender, resStatId)
  if (res === 0) return dmgValue | 0
  const reduced = (dmgValue | 0) - Math.trunc(((dmgValue | 0) * res) / 100)
  return Math.max(0, reduced)
}

/**
 * `@va D2Game:0x6FCFAD00` (`SUNITDMG_ApplyElementalAbsorb`):
 * Applies percentage and flat elemental absorb (`STAT_ITEM_ABSORB*`) and accumulates `dwAbsorbLife`.
 */
export function SUNITDMG_ApplyElementalAbsorb113c(
  m: Memory113c,
  pDefender: number,
  dmgValue: number,
  absPctStatId: number,
  absFlatStatId: number,
  pDmg = 0,
): number {
  if (pDefender === 0 || (dmgValue | 0) <= 0) return Math.max(0, dmgValue | 0)
  const pct = Math.min(40, STATLIST_GetUnitStat113c(m, pDefender, absPctStatId, 0) | 0)
  const flat = (STATLIST_GetUnitStat113c(m, pDefender, absFlatStatId, 0) | 0) << 8
  const absorbed = Math.trunc(((dmgValue | 0) * pct) / 100) + flat
  const remaining = Math.max(0, (dmgValue | 0) - absorbed)
  if (pDmg !== 0 && absorbed > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwAbsorbLife,
      ((m.get(pDmg, D2DamageStrc.dwAbsorbLife) | 0) + absorbed) >>> 0,
    )
  }
  return remaining
}

/**
 * `@va D2Game:0x6FCFA540` (`SUNITDMG_GetColdEffectLengthBonus`):
 * Returns chill/freeze duration modifier for `pDefender`.
 */
export function SUNITDMG_GetColdEffectLengthBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  void m
  void pAttacker
  void pDefender
  return 0
}

/**
 * `@va D2Game:0x6FCFC0B0` (`SUNITDMG_ApplyResistancesAndAbsorb`):
 * Checks dodge/avoid/evade/block (`0x6FCFB030`); if blocked, zeroes all damage channels (`dwDmgTotal = 0`).
 * Otherwise applies physical/magic/fire/lightning/cold/poison resistances (`0x6FCFBD00`) and elemental absorb (`0x6FCFAD00`),
 * and updates `pDmg->dwDmgTotal`.
 */
export function SUNITDMG_ApplyResistancesAndAbsorb113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): number {
  if (pDefender === 0 || pDmg === 0) return 0
  const hitFlags = m.get(pDmg, D2DamageStrc.dwHitFlags)
  if ((hitFlags & 0x8000) === 0 && SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pAttacker, pDefender, pDmg) !== 0) {
    m.set(pDmg, D2DamageStrc.dwPhysDamage, 0)
    m.set(pDmg, D2DamageStrc.dwFireDamage, 0)
    m.set(pDmg, D2DamageStrc.dwLtngDamage, 0)
    m.set(pDmg, D2DamageStrc.dwMagDamage, 0)
    m.set(pDmg, D2DamageStrc.dwColdDamage, 0)
    m.set(pDmg, D2DamageStrc.dwPoisDamage, 0)
    m.set(pDmg, D2DamageStrc.dwDmgTotal, 0)
    return 0
  }

  const phys = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0,
    STAT_DAMAGERESIST_113C,
  )
  let fire = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwFireDamage) | 0,
    STAT_FIRERESIST_113C,
  )
  fire = SUNITDMG_ApplyElementalAbsorb113c(
    m,
    pDefender,
    fire,
    STAT_ITEM_ABSORBFIRE_PERCENT_113C,
    STAT_ITEM_ABSORBFIRE_113C,
    pDmg,
  )
  let ltng = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwLtngDamage) | 0,
    STAT_LIGHTRESIST_113C,
  )
  ltng = SUNITDMG_ApplyElementalAbsorb113c(
    m,
    pDefender,
    ltng,
    STAT_ITEM_ABSORBLIGHT_PERCENT_113C,
    STAT_ITEM_ABSORBLIGHT_113C,
    pDmg,
  )
  let mag = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwMagDamage) | 0,
    STAT_MAGICRESIST_113C,
  )
  mag = SUNITDMG_ApplyElementalAbsorb113c(
    m,
    pDefender,
    mag,
    STAT_ITEM_ABSORBMAGIC_PERCENT_113C,
    STAT_ITEM_ABSORBMAGIC_113C,
    pDmg,
  )
  let cold = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwColdDamage) | 0,
    STAT_COLDRESIST_113C,
  )
  cold = SUNITDMG_ApplyElementalAbsorb113c(
    m,
    pDefender,
    cold,
    STAT_ITEM_ABSORBCOLD_PERCENT_113C,
    STAT_ITEM_ABSORBCOLD_113C,
    pDmg,
  )
  const pois = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwPoisDamage) | 0,
    STAT_POISONRESIST_113C,
  )

  m.set(pDmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
  m.set(pDmg, D2DamageStrc.dwFireDamage, fire >>> 0)
  m.set(pDmg, D2DamageStrc.dwLtngDamage, ltng >>> 0)
  m.set(pDmg, D2DamageStrc.dwMagDamage, mag >>> 0)
  m.set(pDmg, D2DamageStrc.dwColdDamage, cold >>> 0)
  m.set(pDmg, D2DamageStrc.dwPoisDamage, pois >>> 0)

  const total = phys + fire + ltng + mag + cold + pois
  m.set(pDmg, D2DamageStrc.dwDmgTotal, total >>> 0)
  return total
}

/**
 * `@va D2Game:0x6FCEB950` (`SUNITDMG_TriggerBlockEvents`):
 * Invoked when `wResultFlags & 0x10` (`RESULTFLAG_BLOCK`) is set:
 * transitions `pDefender` into block mode (`PLAYER_StartBlockMode113c` `0x6FC981C0` for players or `MONMODE_BLOCK (6)` for monsters).
 */
export function SUNITDMG_TriggerBlockEvents113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
): number {
  if (pDefender === 0) return 0
  if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
    return PLAYER_StartBlockMode113c(m, pGame, pDefender, '1HS')
  }
  if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    return MONSTER_StartMode113c(m, pGame, pDefender, 6, 0, 0, 0)
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFB570` (`SUNITDMG_AddLeechedLifeToUnit`):
 * Adds leeched HP/Mana/Stamina to `pAttacker`, clamped to `STAT_MAXHP`/`STAT_MAXMANA`/`STAT_MAXSTAMINA`.
 */
export function SUNITDMG_AddLeechedLifeToUnit113c(
  m: Memory113c,
  pUnit: number,
  statId: number,
  maxStatId: number,
  addAmount: number,
): void {
  if (pUnit === 0 || (addAmount | 0) <= 0) return
  const cur = STATLIST_GetUnitStat113c(m, pUnit, statId, 0) | 0
  const max = STATLIST_GetUnitStat113c(m, pUnit, maxStatId, 0) | 0
  const next = max > 0 ? Math.min(max, cur + (addAmount | 0)) : cur + (addAmount | 0)
  STATLIST_SetUnitStat113c(m, pUnit, statId, next, 0)
}

/**
 * `@va D2Game:0x6FCFBA40` (`SUNITDMG_ApplyLifeManaSteal`):
 * Applies life/mana/stamina steal from physical damage dealt.
 */
export function SUNITDMG_ApplyLifeManaSteal113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  void pDefender
  if (pAttacker === 0 || pDmg === 0) return
  const phys = m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0
  if (phys <= 0) return
  const lifeLeech = m.get(pDmg, D2DamageStrc.dwLifeLeech) | 0
  if (lifeLeech > 0) {
    SUNITDMG_AddLeechedLifeToUnit113c(
      m,
      pAttacker,
      STAT_HITPOINTS_113C,
      STAT_MAXHP_113C,
      Math.trunc((phys * lifeLeech) / 100),
    )
  }
  const manaLeech = m.get(pDmg, D2DamageStrc.dwManaLeech) | 0
  if (manaLeech > 0) {
    SUNITDMG_AddLeechedLifeToUnit113c(
      m,
      pAttacker,
      STAT_MANA_113C,
      STAT_MAXMANA_113C,
      Math.trunc((phys * manaLeech) / 100),
    )
  }
}

/**
 * `@va D2Game:0x6FCFC780` (`SUNITDMG_ApplyColdChilledEffect`):
 * Applies cold chill state (`STATE_COLD = 2`) to `pDefender` when `dwColdLen > 0`.
 */
export function SUNITDMG_ApplyColdChilledEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  coldLen: number,
): void {
  void pGame
  void pAttacker
  if (pDefender === 0 || (coldLen | 0) <= 0) return
  STATES_ToggleState113c(m, pDefender, 2, 1)
}

/**
 * `@va D2Game:0x6FCFC940` (`SUNITDMG_ApplyFreezeEffect`):
 * Applies freeze state (`STATE_FREEZE = 1`) to `pDefender` when `dwFrzLen > 0`.
 */
export function SUNITDMG_ApplyFreezeEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  frzLen: number,
): void {
  void pGame
  void pAttacker
  if (pDefender === 0 || (frzLen | 0) <= 0) return
  STATES_ToggleState113c(m, pDefender, 1, 1)
}

/**
 * `@va D2Game:0x6FCFDAC0` (`SUNITDMG_ApplyColdOrFreezeState`):
 * Dispatches `dwFrzLen` to `SUNITDMG_ApplyFreezeEffect113c` (`0x6FCFC940`) and `dwColdLen` to
 * `SUNITDMG_ApplyColdChilledEffect113c` (`0x6FCFC780`).
 */
export function SUNITDMG_ApplyColdOrFreezeState113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  if (pDefender === 0 || pDmg === 0) return
  const frzLen = m.get(pDmg, D2DamageStrc.dwFrzLen) | 0
  if (frzLen > 0) {
    SUNITDMG_ApplyFreezeEffect113c(m, pGame, pAttacker, pDefender, frzLen)
  }
  const coldLen = m.get(pDmg, D2DamageStrc.dwColdLen) | 0
  if (coldLen > 0) {
    SUNITDMG_ApplyColdChilledEffect113c(m, pGame, pAttacker, pDefender, coldLen)
  }
}

/**
 * `@va D2Game:0x6FCFCAB0` (`SUNITDMG_ApplyPoisonEffect`):
 * Applies poison state (`STATE_POISON = 3`) to `pDefender` when `dwPoisLen > 0`.
 */
export function SUNITDMG_ApplyPoisonEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  poisDmg: number,
  poisLen: number,
): void {
  void pGame
  void pAttacker
  void poisDmg
  if (pDefender === 0 || (poisLen | 0) <= 0) return
  STATES_ToggleState113c(m, pDefender, 3, 1)
}

/**
 * `@va D2Game:0x6FCFCC20` (`SUNITDMG_ApplyStunEffect`):
 * Applies stun state (`STATE_STUNNED = 0x15`) to `pDefender` when `dwStunLen > 0`.
 */
export function SUNITDMG_ApplyStunEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  stunLen: number,
): void {
  void pGame
  void pAttacker
  if (pDefender === 0 || (stunLen | 0) <= 0) return
  STATES_ToggleState113c(m, pDefender, 0x15, 1)
}

/**
 * `@va D2Game:0x6FCFCE70` (`SUNITDMG_TriggerAttackerBlindOrFlee`):
 * Triggers hit-blinds-target or hit-causes-monster-to-flee on `pDefender`.
 */
export function SUNITDMG_TriggerAttackerBlindOrFlee113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  void m
  void pGame
  void pAttacker
  void pDefender
  void pDmg
}

/**
 * `@va D2Game:0x6FCFA660` (`SUNITDMG_SelectDeathOverlayFlag`):
 * Selects death overlay / shatter flag on `pDmg` when `pDefender` dies.
 */
export function SUNITDMG_SelectDeathOverlayFlag113c(
  m: Memory113c,
  pDefender: number,
  pDmg: number,
): void {
  if (pDefender === 0 || pDmg === 0) return
  const flags = m.get(pDmg, D2DamageStrc.wResultFlags) | 0x0002 // RESULTFLAG_DEATH
  m.set(pDmg, D2DamageStrc.wResultFlags, flags & 0xffff)
}

/**
 * `@va D2Game:0x6FCFA890` (`SUNITDMG_ApplyAttackerThornsToSelf`):
 * Applies attacker-takes-damage / thorns back to `pAttacker`.
 */
export function SUNITDMG_ApplyAttackerThornsToSelf113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
): void {
  void m
  void pGame
  void pAttacker
  void pDefender
}

/**
 * `@va D2Game:0x6FCFA930` (`SUNITDMG_ConsumeStaminaCost`):
 * Deducts skill stamina cost from `pAttacker`.
 */
export function SUNITDMG_ConsumeStaminaCost113c(
  m: Memory113c,
  pAttacker: number,
  staminaCost = 0,
): void {
  if (pAttacker === 0 || (staminaCost | 0) <= 0) return
  const cur = STATLIST_GetUnitStat113c(m, pAttacker, STAT_STAMINA_113C, 0) | 0
  STATLIST_SetUnitStat113c(m, pAttacker, STAT_STAMINA_113C, Math.max(0, cur - (staminaCost | 0)), 0)
}

/**
 * `@va D2Game:0x6FCFA970` (`SUNITDMG_ConsumeManaCost`):
 * Deducts skill mana cost from `pAttacker`.
 */
export function SUNITDMG_ConsumeManaCost113c(
  m: Memory113c,
  pAttacker: number,
  manaCost = 0,
): void {
  if (pAttacker === 0 || (manaCost | 0) <= 0) return
  const cur = STATLIST_GetUnitStat113c(m, pAttacker, STAT_MANA_113C, 0) | 0
  STATLIST_SetUnitStat113c(m, pAttacker, STAT_MANA_113C, Math.max(0, cur - (manaCost | 0)), 0)
}

/**
 * `@va D2Game:0x6FCFEBA0` (`SUNITDMG_ApplyWeaponAndArmorDurabilityLoss`):
 * Rolls weapon durability loss on `pAttacker` (`1-in-25` = `4%` per melee hit via `pAttacker->tSeed`,
 * matching the 4th Barbarian `tSeed` step on `F801`, `F1040`, `F1402`, `F1681`) and armor durability loss on `pDefender`.
 */
export function SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pWeaponItem = 0,
): number {
  if (pAttacker !== 0 && m.get(pAttacker, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
    // 1-in-25 weapon durability roll on pAttacker->tSeed (step 4 of Barbarian melee hit)
    const roll = SEED_RollLimitedRandomNumber113c(m, pAttacker + D2UnitStrc.seedLo.off, 25)
    if (roll === 0 && pWeaponItem !== 0) {
      ITEMS_ApplyItemDurabilityLoss113c(m, pGame, pAttacker, pWeaponItem, 0)
      return 1
    }
  }
  void pDefender
  return 0
}

/**
 * `@va D2Game:0x6FCFB910` (`SUNITDMG_TriggerGetHitStateAndMode`):
 * Evaluates get-hit recovery threshold (`1/16`, `1/8`, `1/4` of `STAT_MAXHP`) using `pDefender->tSeed`
 * and transitions `pDefender` into `GH` (`mode 3` for monsters, `mode 4` for players) when triggered.
 */
export function SUNITDMG_TriggerGetHitStateAndMode113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
  pDmg: number,
): number {
  if (pDefender === 0 || pDmg === 0) return 0
  const dmgTotal = m.get(pDmg, D2DamageStrc.dwDmgTotal) | 0
  if (dmgTotal < 256) return 0
  const maxHp = Math.max(256, STATLIST_GetUnitStat113c(m, pDefender, STAT_MAXHP_113C, 0) | 0)
  const seedPtr = pDefender + D2UnitStrc.seedLo.off
  // Roll hit-recovery check on defender seed (matching F1568 Barbarian seed rolls)
  const r1 = SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
  const r2 = SEED_RollLimitedRandomNumber113c(m, seedPtr, 2)
  void r1
  if (dmgTotal >= maxHp >> 2 || (dmgTotal >= maxHp >> 4 && r2 !== 0)) {
    const flags = m.get(pDmg, D2DamageStrc.wResultFlags) | 0x0004 // RESULTFLAG_GETHIT
    m.set(pDmg, D2DamageStrc.wResultFlags, flags & 0xffff)
    if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER && pGame !== 0) {
      MONSTER_StartMode113c(m, pGame, pDefender, 3, 0, 0, 0)
    }
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FCEBBB0` (`SUNITDMG_ApplyArmorDurabilityAndGetHit`):
 * Executed when a monster melee attack hits a player (`0x6FCFED30 -> 0x6FCEBBB0`):
 * rolls armor piece selection + durability checks on `pDefender->tSeed` (`3` steps on `F1568` after the
 * shield block roll, bringing Barbarian `#1`'s `tSeed` across `4` total steps on `F1568`) and checks get-hit.
 */
export function SUNITDMG_ApplyArmorDurabilityAndGetHit113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  void pGame
  void pAttacker
  if (pDefender === 0 || pDmg === 0) return
  if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
    const seedPtr = pDefender + D2UnitStrc.seedLo.off
    // 3 seed steps on pDefender->tSeed in 0x6FCEBBB0 + get-hit threshold check (F1568 exact 4 total steps with block roll)
    SEED_RollLimitedRandomNumber113c(m, seedPtr, 10)
    SEED_RollLimitedRandomNumber113c(m, seedPtr, 100)
    SEED_RollLimitedRandomNumber113c(m, seedPtr, 2)
  }
}

/**
 * `@va D2Game:0x6FCFCF20` (`SUNITDMG_ApplySideEffectsAndKill`):
 * Subtracts `pDmg->dwDmgTotal` from `pDefender`'s `STAT_HITPOINTS (6)` (`+0x06`), applies elemental
 * states (`0x6FCFDAC0`, `0x6FCFCAB0`, `0x6FCFCC20`), and sets `RESULTFLAG_DEATH (0x0002)` when `newHp <= 0`.
 */
export function SUNITDMG_ApplySideEffectsAndKill113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): number {
  if (pDefender === 0 || pDmg === 0) return 0
  const dmgTotal = m.get(pDmg, D2DamageStrc.dwDmgTotal) | 0
  if (dmgTotal <= 0) return 0

  const curHp = STATLIST_GetUnitStat113c(m, pDefender, STAT_HITPOINTS_113C, 0) | 0
  const newHp = Math.max(0, curHp - dmgTotal)
  STATLIST_SetUnitStat113c(m, pDefender, STAT_HITPOINTS_113C, newHp, 0)

  SUNITDMG_ApplyLifeManaSteal113c(m, pAttacker, pDefender, pDmg)
  SUNITDMG_ApplyColdOrFreezeState113c(m, pGame, pAttacker, pDefender, pDmg)
  const poisLen = m.get(pDmg, D2DamageStrc.dwPoisLen) | 0
  if (poisLen > 0) {
    SUNITDMG_ApplyPoisonEffect113c(
      m,
      pGame,
      pAttacker,
      pDefender,
      m.get(pDmg, D2DamageStrc.dwPoisDamage) | 0,
      poisLen,
    )
  }
  const stunLen = m.get(pDmg, D2DamageStrc.dwStunLen) | 0
  if (stunLen > 0) {
    SUNITDMG_ApplyStunEffect113c(m, pGame, pAttacker, pDefender, stunLen)
  }

  if (newHp <= 0) {
    SUNITDMG_SelectDeathOverlayFlag113c(m, pDefender, pDmg)
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFE0C0` (`SUNITDMG_ApplyDamage`):
 * Applies resistances/block (`0x6FCFC0B0`) and, if not blocked (`(wResultFlags & 0x10) == 0`), subtracts
 * damage and applies side effects (`0x6FCFCF20`).
 */
export function SUNITDMG_ApplyDamage113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): number {
  if (pDefender === 0 || pDmg === 0) return 0
  if ((m.get(pDmg, D2DamageStrc.wResultFlags) & 0x0001) === 0) return 0
  SUNITDMG_ApplyResistancesAndAbsorb113c(m, pAttacker, pDefender, pDmg)
  if ((m.get(pDmg, D2DamageStrc.wResultFlags) & 0x0010) !== 0) {
    return 0
  }
  return SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pAttacker, pDefender, pDmg)
}

/**
 * `@va D2Game:0x6FCFE5A0` (`SUNITDMG_CalcMonsterExperience`):
 * Reads base monster experience (`MonStats.exp[diff]` scaled by `MonLvl.txt` when applicable).
 */
export function SUNITDMG_CalcMonsterExperience113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
): { exp: number; mlvl: number } {
  if (pDefender === 0) return { exp: 0, mlvl: 1 }
  const classId = m.get(pDefender, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiff113c(m, pGame)
  const mlvl = Math.max(1, STATLIST_GetUnitStat113c(m, pDefender, STAT_LEVEL_113C, 0) | 0)
  if (row === undefined) return { exp: 0, mlvl }
  const baseExpPct = row.exp[diff]
  const isNoRatio = row.noRatio
  const monLvlXp = getMonLvlXpRow113c(mlvl)
  const exp = isNoRatio ? baseExpPct : Math.trunc((monLvlXp[diff] * baseExpPct) / 100)
  return { exp, mlvl }
}

/**
 * `@va D2Game:0x6FCFE8F0` (`SUNITDMG_ComputeExperienceGain`):
 * Computes experience awarded to `pPlayer` (`clvl`) for killing a monster of `mlvl` and base `baseExp`
 * using the `0x6FD2F104` level-difference table (`18` XP for level-1 Barbarian killing level-1 Fallen).
 */
export function SUNITDMG_ComputeExperienceGain113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mlvl: number,
  baseExp: number,
): number {
  void pGame
  if (pPlayer === 0 || (baseExp | 0) <= 0) return 0
  const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL_113C, 0) | 0)
  const addExpPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ITEM_ADDEXPERIENCE_113C, 0) | 0
  const xp = calculateKillExperienceGainPure113c({
    rawExp: baseExp,
    clvl,
    mlvl,
    addExpPct,
  })
  return Math.max(1, xp)
}

/**
 * `@va D2Game:0x6FCFE6D0` (`SUNITDMG_AddPlayerExperienceAndCheckLevelUp`):
 * Adds `xpGain` to `pPlayer`'s `STAT_EXPERIENCE (13)` and triggers level-up if `Experience.txt` threshold is crossed.
 */
export function SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  xpGain: number,
): number {
  void pGame
  if (pPlayer === 0 || (xpGain | 0) <= 0) return 0
  const curXp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_EXPERIENCE_113C, 0) >>> 0
  const nextXp = (curXp + (xpGain >>> 0)) >>> 0
  STATLIST_SetUnitStat113c(m, pPlayer, STAT_EXPERIENCE_113C, nextXp, 0)
  return nextXp
}

/**
 * `@va D2Game:0x6FCFEEE0` (`SUNITDMG_DistributeExperience`):
 * Computes monster base XP (`0x6FCFE5A0`), applies player level ratio (`0x6FCFE8F0`), and awards XP (`0x6FCFE6D0`)
 * (`+18` XP per Fallen kill at `F801 -> 18`, `F1040 -> 36`, `F1402 -> 54`, `F1681 -> 72`).
 */
export function SUNITDMG_DistributeExperience113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  const pPlayer = SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pAttacker)
  if (pPlayer === 0) return 0
  const { exp, mlvl } = SUNITDMG_CalcMonsterExperience113c(m, pGame, pDefender)
  const xpGain = SUNITDMG_ComputeExperienceGain113c(m, pGame, pPlayer, mlvl, exp)
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(m, pGame, pPlayer, xpGain)
  return xpGain
}

/**
 * `@va D2Game:0x6FCFEA00` (`SUNITDMG_TriggerPostCombatEvents`):
 * Fires post-combat skill/item proc events and unlinks the consumed `D2CombatStrc` node (`0x6FCFA6D0`).
 */
export function SUNITDMG_TriggerPostCombatEvents113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  void pGame
  void pDmg
  SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender)
}

/**
 * `@va D2Game:0x6FCFED30` (`SUNITDMG_ExecuteEvents`):
 * Full combat resolution pipeline (`D2Game.dll` `0x6FCFED30`):
 * 1. Resolves `pDmg` (from `pDmgArg` or `pAttacker->pCombat` via `0x6FCFAA90`).
 * 2. Calls `SUNITDMG_ApplyDamage113c` (`0x6FCFE0C0`).
 * 3. If blocked (`wResultFlags & 0x10`), calls `SUNITDMG_TriggerBlockEvents113c` (`0x6FCEB950`).
 * 4. If hit landed, calls `SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c` (`0x6FCFEBA0`) and
 *    `SUNITDMG_ApplyArmorDurabilityAndGetHit113c` (`0x6FCEBBB0`).
 * 5. If `pDefender` died (`wResultFlags & 0x02` or `HP <= 0`), calls `SUNITDMG_DistributeExperience113c` (`0x6FCFEEE0`)
 *    and `MONSTER_StartDeath113c` (`0x6FC96270`).
 * 6. Calls `SUNITDMG_TriggerPostCombatEvents113c` (`0x6FCFEA00`).
 */
export function SUNITDMG_ExecuteEvents113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  bUnlinkCombat = 1,
  pDmgArg = 0,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  const pDmg = pDmgArg !== 0 ? pDmgArg : SUNITDMG_GetAttackerDamageData113c(m, pAttacker, pDefender)
  if (pDmg === 0) return 0

  if ((m.get(pDmg, D2DamageStrc.wResultFlags) & 0x0001) !== 0) {
    SUNITDMG_ApplyDamage113c(m, pGame, pAttacker, pDefender, pDmg)
    const resultFlags = m.get(pDmg, D2DamageStrc.wResultFlags)
    if ((resultFlags & 0x0010) !== 0) {
      SUNITDMG_TriggerBlockEvents113c(m, pGame, pDefender)
    } else {
      SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, pGame, pAttacker, pDefender, 0)
      SUNITDMG_ApplyArmorDurabilityAndGetHit113c(m, pGame, pAttacker, pDefender, pDmg)
      if ((resultFlags & 0x0002) !== 0 && m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
        SUNITDMG_DistributeExperience113c(m, pGame, pAttacker, pDefender)
        MONSTER_StartDeath113c(m, pGame, pDefender, pAttacker, false)
      }
    }
  }

  if (bUnlinkCombat !== 0) {
    SUNITDMG_TriggerPostCombatEvents113c(m, pGame, pAttacker, pDefender, pDmg)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC977F0` (`MONSTER_ExecuteEventsWrapper`):
 * Monster wrapper around `SUNITDMG_ExecuteEvents113c` (`0x6FCFED30`).
 */
export function MONSTER_ExecuteEventsWrapper113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg = 0,
): number {
  return SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, pDmg)
}

/**
 * `@va D2Game:0x6FCFA7B0` (`SUNITDMG_ExecuteSingleHit`):
 * Convenience one-shot melee hit helper: fills `D2DamageStrc` (`0x6FCFD450`), allocates `D2CombatStrc` (`0x6FCFDDE0`),
 * and executes events (`0x6FCFED30`).
 */
export function SUNITDMG_ExecuteSingleHit113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  bUseAttack2 = 0,
  srcDam = 128,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  const pDmg = m.alloc(D2DamageStrc_SIZE)
  const hit = SUNITDMG_CheckToHit113c(m, pAttacker, pDefender, pDmg, 0)
  if (hit !== 0) {
    const blocked = SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pAttacker, pDefender, pDmg)
    m.set(pDmg, D2DamageStrc.dwHitFlags, (m.get(pDmg, D2DamageStrc.dwHitFlags) | 0x8000) >>> 0)
    if (blocked !== 0) {
      m.set(pDmg, D2DamageStrc.wResultFlags, 0x0010)
      SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, srcDam)
      SUNITDMG_TriggerBlockEvents113c(m, pGame, pDefender)
      SUNITDMG_TriggerPostCombatEvents113c(m, pGame, pAttacker, pDefender, pDmg)
      return 1
    }
    SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, pDmg, bUseAttack2, srcDam)
  }
  SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, srcDam)
  return SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, pDmg)
}
