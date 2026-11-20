/**
 * Diablo II v1.13c Pure Kernel Combat, Zombie/Fallen AI, Melee Exchange, Boss Promotion,
 * Experience Distribution & Treasure-Class Loot Drop (`a1c-bloodmoor-fallen` `F226..F2000`).
 *
 * All functions operate 100% on `Memory113c` (`D2GameStrc`, `D2UnitStrc`, `D2MonsterDataStrc`,
 * `D2AiGeneralStrc`, `D2AiCmdStrc`, `D2CombatStrc`, `D2DamageStrc`, `D2DynamicPathStrc`,
 * `D2ActiveRoomStrc`, `D2StatListExStrc`) with zero JS Map caches, zero array sorting, and zero nullish fallbacks.
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
  UNITS_GetBlockChance113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import { MONSTERS_GetCompCode113c } from '../common/monsters.ts'
import { UNITS_IsInMovingMode113c } from '../common/waypoint.ts'
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
  setK2MonsterDropLootHook113c,
} from './monster-events.ts'
import {
  calculateKillExperienceGainPure113c,
  computeFrwDiminishingPure113c,
  computeRawPlayerAnimSpeedPure113c,
  getCharAnimClipPure113c,
  getCharStatsPure113c,
  getMonLvlXpRow113c,
  getMonStatsRowByClassId113c,
  getMonStatsTxtPtrPure113c,
  getMonsterModeBaseAnimSpeed256Pure113c,
  getMonsterModeBaseFrameCountPure113c,
  getMonsterModeFlagsPure113c,
  isItemCodeShieldPure113c,
  isMonsterCritterPure113c,
  playerAnimStartFramePure113c,
} from './tables-bootstrap-113c.ts'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_ApplyGoldFindBonus_6FC2F260_113c,
  ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c,
  ITEMS_ChooseTreasureClassAndDrop_6FC32380_113c,
  ITEMS_CreateDroppedItemAtUnit_6FC31880_113c,
  ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c,
  ITEMS_DropMonsterTreasure_6FC32D60_113c,
  ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c,
  ITEMS_FinalizeNormalExpansionItem_6FC30550_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
  ITEMS_InitCreatedItemStats_6FC31070_113c,
  ITEMS_InitItemUnit_6FC30160_113c,
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_RollAndApplyEthereal_6FC2EBB0_113c,
  ITEMS_RollAndApplySockets_6FC2EC90_113c,
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c,
  ITEMS_RollItemQuality_6FC2FC40_113c,
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c,
  ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c,
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c,
  MONSTER_DropDeathItems_6FC95900_113c,
  MONSTER_DropTreasureOnDeath_6FC95680_113c,
  OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c,
  isItemRatioTableLoaded113c,
  isSgptDataTablesLoaded113c,
} from './k2-real-itemdrop-113c.ts'
import {
  AI_DispatchTargetByAiFlag113c,
  AI_FindNearestPlayerOrAlly113c,
  AI_FindTargetScanRoomCallback113c,
  AI_FleeFrom113c,
  AI_GeneralFindTargetOrThrottle113c,
  AI_IdleWander113c,
  AI_RunMonsterAI113c,
  AI_Stall113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_ExpireMinionListsInAct113c,
  AiFallen113c,
  AiZombie113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_CheckSandLeaperMidAir113c,
  MONSTER_EndDeath113c,
  MONSTER_ExecuteEventsWrapper113c,
  MONSTER_SetDeathPathAndAnim113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  PLAYER_AdvanceSkillModeFrame113c,
  PLAYER_ScheduleAttackActionFrameEvents113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartBlockMode113c,
  PLAYER_StartModeCast113c,
  PLAYER_StartModeDispatch113c,
  PLAYER_StartModeSkill113c,
  ROOM_RecordMonsterDeath113c,
  SUNITDMG_AddDemonDamageBonus113c,
  SUNITDMG_AddLeechedLifeToUnit113c,
  SUNITDMG_AddMonsterTypeDamageBonus113c,
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyArmorDurabilityAndGetHit113c,
  SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c,
  SUNITDMG_ApplyAttackerThornsToSelf113c,
  SUNITDMG_ApplyColdChilledEffect113c,
  SUNITDMG_ApplyColdOrFreezeState113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyElementalAbsorb113c,
  SUNITDMG_ApplyFreezeEffect113c,
  SUNITDMG_ApplyLifeManaSteal113c,
  SUNITDMG_ApplyPoisonEffect113c,
  SUNITDMG_ApplyResistancesAndAbsorb113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ApplySingleChannelResistance113c,
  SUNITDMG_ApplyStunEffect113c,
  SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c,
  SUNITDMG_CalcMonsterExperience113c,
  SUNITDMG_CheckMonTypeFlag113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_ComputeExperienceGain113c,
  SUNITDMG_ComputeWeaponBaseDamage113c,
  SUNITDMG_ConsumeManaCost113c,
  SUNITDMG_ConsumeStaminaCost113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_ExecuteSingleHit113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_GetAttackerDamageData113c,
  SUNITDMG_GetColdEffectLengthBonus113c,
  SUNITDMG_GetEffectiveResistance113c,
  SUNITDMG_GetPlayerClientClassId113c,
  SUNITDMG_GetPvpOrPetDamageMultiplier113c,
  SUNITDMG_GetTotalSkillDamageBonus113c,
  SUNITDMG_PrependCombatNode113c,
  SUNITDMG_RemoveCombatNode113c,
  SUNITDMG_ResolveAttackerPlayer113c,
  SUNITDMG_RollDamageValue113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollElementalStatDamage113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  SUNITDMG_SelectDeathOverlayFlag113c,
  SUNITDMG_TriggerAttackerBlindOrFlee113c,
  SUNITDMG_TriggerBlockEvents113c,
  SUNITDMG_TriggerGetHitStateAndMode113c,
  SUNITDMG_TriggerPostCombatEvents113c,
} from './k2-real-s2c-combat-113c.ts'
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
  const baseOff =
    unitType === 4
      ? 0x1720
      : unitType === 3
        ? 0x1920
        : unitType === 5
          ? 0x1b20
          : 0x1120 + ((unitType & 3) << 9)
  const bucketOff = unitType === 5 ? 0 : (unitId & 0x7f) << 2
  let pUnit = m.u32((pGame + baseOff + bucketOff) >>> 0)
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
 * `@va D2Game:0x6FC2E5D0` (`ITEMS_GetDropItemLevel`, `eax = pGame`, `edx = pDropper`):
 * Resolves drop `ilvl` for `UNIT_MONSTER` (`STAT_LEVEL`), `UNIT_PLAYER` (`base STAT_LEVEL`),
 * or objects (`DATATBLS_GetLevelMonsterLevel`), clamped to `>= 1`.
 */
export function ITEMS_GetDropItemLevel113c(
  m: Memory113c,
  arg1: number,
  arg2 = 0,
  arg3 = 0,
): number {
  if (arg1 === 0 && arg2 === 0) return 1
  let pGame = arg1 >>> 0
  let pDropper = arg2 >>> 0
  if (arg2 === 0) {
    pDropper = arg1 >>> 0
    pGame = m.u32((pDropper + 0x80) >>> 0) >>> 0
  } else if (
    m.u32((pGame + 0x80) >>> 0) === pDropper ||
    (m.u32(pGame) <= 5 && m.u32((pGame + 0x5c) >>> 0) !== 0 && m.u32((pDropper + 0x5c) >>> 0) === 0)
  ) {
    pDropper = arg1 >>> 0
    pGame = arg2 >>> 0
  }
  return ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame, pDropper, arg3)
}

/**
 * `@va D2Game:0x6FC2EA10` (`ITEMS_ScheduleReplenishQuantityEvent` / `ItemRatio` divisor helper):
 * Schedules `Event 3` (`STAT_ITEM_REPLENISH_QUANTITY` = `253`) when invoked with `UNIT_ITEM`,
 * or reads `ItemRatio.txt` quality divisor when invoked with quality index `1..9`.
 */
export function ITEMS_GetQualityBonusDivisor113c(
  m: Memory113c,
  nQualityOrItem: number,
  pItemRatioRowOrGame: number,
): number {
  const ptr = nQualityOrItem >>> 0
  if (ptr >= 0x1000 && m.u32(ptr) === UNIT_ITEM) {
    ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, pItemRatioRowOrGame >>> 0, ptr)
    return 1
  }
  if (pItemRatioRowOrGame === 0) return 1
  switch (nQualityOrItem | 0) {
    case 7:
      return m.u32(pItemRatioRowOrGame + 0x04) | 0
    case 5:
      return m.u32(pItemRatioRowOrGame + 0x0c) | 0
    case 6:
      return m.u32(pItemRatioRowOrGame + 0x14) | 0
    case 4:
      return m.u32(pItemRatioRowOrGame + 0x1c) | 0
    case 3:
      return m.u32(pItemRatioRowOrGame + 0x24) | 0
    case 2:
      return m.u32(pItemRatioRowOrGame + 0x2c) | 0
    default:
      return 1
  }
}

/**
 * `@va D2Game:0x6FC2EA70` (`ITEMS_ScheduleReplenishDurabilityEvent` / `ItemRatio` min threshold helper):
 * Schedules `Event 3` (`STAT_ITEM_REPLENISH_DURABILITY` = `252`) when invoked with `UNIT_ITEM`,
 * or reads `ItemRatio.txt` minimum threshold when invoked with quality index `1..9`.
 */
export function ITEMS_GetQualityMinValue113c(
  m: Memory113c,
  nQualityOrItem: number,
  pItemRatioRowOrGame: number,
): number {
  const ptr = nQualityOrItem >>> 0
  if (ptr >= 0x1000 && m.u32(ptr) === UNIT_ITEM) {
    ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, pItemRatioRowOrGame >>> 0, ptr)
    return 0
  }
  if (pItemRatioRowOrGame === 0) return 0
  switch (nQualityOrItem | 0) {
    case 7:
      return m.u32(pItemRatioRowOrGame + 0x08) | 0
    case 5:
      return m.u32(pItemRatioRowOrGame + 0x10) | 0
    case 6:
      return m.u32(pItemRatioRowOrGame + 0x18) | 0
    case 4:
      return m.u32(pItemRatioRowOrGame + 0x20) | 0
    default:
      return 0
  }
}

/**
 * `@va D2Game:0x6FC2EBB0` (`ITEMS_RollAndApplyEthereal` / TC quality factor selector):
 * Applies 5% Ethereal roll and `+50%` base defense/damage when invoked on `UNIT_ITEM`,
 * or reads treasure-class quality factor (`Unique`, `Set`, `Rare`, `Magic`) when invoked with quality `1..9`.
 */
export function ITEMS_EvalTreasureClassFactor113c(
  m: Memory113c,
  nQualityOrItem: number,
  pTcFactorsOrDrop: number,
): number {
  const ptr = nQualityOrItem >>> 0
  if (ptr >= 0x1000 && m.u32(ptr) === UNIT_ITEM) {
    ITEMS_RollAndApplyEthereal_6FC2EBB0_113c(m, ptr, pTcFactorsOrDrop >>> 0)
    return 1
  }
  if (pTcFactorsOrDrop === 0) return 0
  switch (nQualityOrItem | 0) {
    case 7:
      return m.u32(pTcFactorsOrDrop + 0x00) | 0
    case 5:
      return m.u32(pTcFactorsOrDrop + 0x04) | 0
    case 6:
      return m.u32(pTcFactorsOrDrop + 0x08) | 0
    case 4:
      return m.u32(pTcFactorsOrDrop + 0x0c) | 0
    default:
      return 0
  }
}

/**
 * `@va D2Game:0x6FC2EC90` (`ITEMS_RollAndApplySockets` / quality threshold roll):
 * Rolls 33% sockets (`STAT_ITEM_NUMSOCKETS = 194`) when invoked with `(pItem, pDrop, pGame)`,
 * or evaluates `ItemRatio` quality threshold against `SEED_RollLimitedRandomNumber`.
 */
export function ITEMS_RollQualityThreshold113c(
  m: Memory113c,
  pSeed: number,
  baseChance: number,
  divisor: number,
  minValue = 0,
  ilvlMinusQlvl = 0,
  mfBonusPct = 0,
  tcFactor = 0,
): number {
  const ptr = pSeed >>> 0
  if (
    ptr >= 0x1000 &&
    m.u32(ptr) === UNIT_ITEM &&
    (baseChance >>> 0) >= 0x1000 &&
    (divisor >>> 0) >= 0x1000
  ) {
    ITEMS_RollAndApplySockets_6FC2EC90_113c(m, ptr, baseChance >>> 0, divisor >>> 0)
    return 1
  }
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
 * Full `ItemRatio.txt` + diminishing Magic Find + `TreasureClassEx` factor quality evaluator (`1..7`).
 */
export function ITEMS_RollItemQuality113c(
  m: Memory113c,
  pGameOrDrop: number,
  pDropper = 0,
  pSeed = 0,
  itemClassId = -1,
  ilvl = 1,
  pTcFactors = 0,
): number {
  if (pGameOrDrop === 0) return 2
  if (pDropper === 0 && pSeed === 0 && itemClassId < 0) {
    const pDrop = pGameOrDrop >>> 0
    return ITEMS_RollItemQuality_6FC2FC40_113c(
      m,
      m.u32((pDrop + 0x08) >>> 0),
      m.u32(pDrop),
      0,
      m.u32((pDrop + 0x14) >>> 0) | 0,
      m.u32((pDrop + 0x0c) >>> 0) | 0,
      (pDrop + 0x70) >>> 0,
      m.u32((pDrop + 0x04) >>> 0),
    )
  }
  if (!isSgptDataTablesLoaded113c(m) || pSeed === 0) return 2
  let pFac16 = 0
  if (pTcFactors !== 0) {
    pFac16 = 0x6fd3f300
    m.fill(pFac16, 16, 0)
    m.setU16(pFac16 + 0, m.u32((pTcFactors >>> 0) + 0x0c) & 0xffff) // Magic
    m.setU16(pFac16 + 2, m.u32((pTcFactors >>> 0) + 0x08) & 0xffff) // Rare
    m.setU16(pFac16 + 4, m.u32((pTcFactors >>> 0) + 0x04) & 0xffff) // Set
    m.setU16(pFac16 + 6, m.u32((pTcFactors >>> 0) + 0x00) & 0xffff) // Unique
  }
  return ITEMS_RollItemQuality_6FC2FC40_113c(
    m,
    pGameOrDrop >>> 0,
    pDropper >>> 0,
    0,
    itemClassId | 0,
    ilvl | 0,
    pFac16,
    pSeed >>> 0,
  )
}

/**
 * `@va D2Game:0x6FC2EE90` (`ITEMS_RollItemQualityOnCreatedItem` / socket & ethereal helper):
 * Evaluates created-item quality on `ITEMS_GetItemSeed(pItem)` (`0x6FC2EE90`), or applies
 * Ethereal (`0x6FC2EBB0`) + Sockets (`0x6FC2EC90`) when invoked with `(pGame, pItem, allowSockets)`.
 */
export function ITEMS_ApplySocketAndEtherealBonuses113c(
  m: Memory113c,
  arg1: number,
  arg2: number,
  allowSockets = 0,
): number {
  const u1 = arg1 >>> 0
  const u2 = arg2 >>> 0
  if (u1 >= 0x1000 && m.u32(u1) === UNIT_ITEM) {
    return ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, u1, u2)
  }
  if (u2 >= 0x1000 && m.u32(u2) === UNIT_ITEM) {
    const itemGame = m.u32((u2 + 0x80) >>> 0) >>> 0
    if (u1 !== 0 && u1 !== itemGame) {
      return ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, u2, u1)
    }
    if (isSgptDataTablesLoaded113c(m)) {
      const pDrop = 0x6fd3f300
      m.fill(pDrop, 0x84, 0)
      m.setU32((pDrop + 0x08) >>> 0, u1)
      m.setU32((pDrop + 0x14) >>> 0, m.u32((u2 + 0x04) >>> 0))
      m.setU32((pDrop + 0x80) >>> 0, allowSockets !== 0 ? 0 : 8)
      ITEMS_RollAndApplyEthereal_6FC2EBB0_113c(m, u2, pDrop)
      ITEMS_RollAndApplySockets_6FC2EC90_113c(m, u2, pDrop, u1)
    }
  }
  return 2
}

/**
 * `@va D2Game:0x6FC2F260` (`ITEMS_ApplyGoldFindBonus` / scroll spell icon helper):
 * Applies `STAT_ITEM_GOLDBONUS (79)` on dropped gold piles (`0x6FC2F260`), or sets spell icon on scroll/tome.
 */
export function ITEMS_InitScrollOrTomeStats113c(
  m: Memory113c,
  pKillerOrItem: number,
  pGoldItemOrSpell = 0,
  nBaseGold = 0,
): void {
  const u2 = pGoldItemOrSpell >>> 0
  if (nBaseGold !== 0 && u2 >= 0x1000 && m.u32(u2) === UNIT_ITEM) {
    ITEMS_ApplyGoldFindBonus_6FC2F260_113c(m, u2, pKillerOrItem >>> 0)
    return
  }
  if (pKillerOrItem === 0) return
  const pItemData = m.get(pKillerOrItem, D2UnitStrc.pUnitData)
  if (pItemData !== 0 && pGoldItemOrSpell > 0) {
    m.setU32(pItemData + 0x30, pGoldItemOrSpell >>> 0)
  }
}

/**
 * `@va D2Game:0x6FC2FB70` (`ITEMS_ExpireGroundItemsInAct`):
 * Sweeps ground `UNIT_ITEM`s (`mode == 3`) in `pAct`'s active rooms and frees items whose
 * `dwActionStamp` (`pItemData + 0x24`) has expired against `pGame->dwGameFrame`.
 */
export function ITEMS_ExpireGroundItemsInAct113c(
  m: Memory113c,
  pGame: number,
  pAct: number,
): void {
  ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c(m, pGame, pAct)
}

/**
 * `@va D2Game:0x6FC30160` (`ITEMS_InitItemUnit`):
 * Initializes `dwUnitId`, `(dwFlags & ~8) | 2`, `ITEMCMD_NEWITEM (0x10)`, `STATLIST_CreateEx`,
 * quest attachment, and event cleanup on a newly allocated `UNIT_ITEM`.
 */
export function ITEMS_RollEarOrClassItem113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  dwUnitId = -1,
): number {
  if (pItem === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 1
  return ITEMS_InitItemUnit_6FC30160_113c(m, pGame, pItem, dwUnitId)
}

/**
 * `@va D2Game:0x6FC30550` (`ITEMS_FinalizeNormalExpansionItem`):
 * Finalizes charms, organs, body parts, scrolls, tomes, and staffmods (`0x6FC33DE0`) on a Normal Expansion item.
 */
export function ITEMS_PickUniqueItem113c(
  m: Memory113c,
  arg1: number,
  arg2: number,
): number {
  if (!isSgptDataTablesLoaded113c(m)) return 0
  const u1 = arg1 >>> 0
  const u2 = arg2 >>> 0
  if (u1 >= 0x1000 && m.u32(u1) === UNIT_ITEM) {
    return ITEMS_FinalizeNormalExpansionItem_6FC30550_113c(m, u1, u2)
  }
  if (u2 >= 0x1000 && m.u32(u2) === UNIT_ITEM) {
    const pDrop = 0x6fd3f300
    m.fill(pDrop, 0x84, 0)
    const pData = m.u32((u2 + 0x14) >>> 0) >>> 0
    m.setU32((pDrop + 0x08) >>> 0, u1)
    m.setU32((pDrop + 0x0c) >>> 0, pData !== 0 ? m.u32((pData + 0x2c) >>> 0) : 1)
    m.setU32((pDrop + 0x14) >>> 0, m.u32((u2 + 0x04) >>> 0))
    return ITEMS_FinalizeNormalExpansionItem_6FC30550_113c(m, u2, pDrop)
  }
  return 0
}

/**
 * `@va D2Game:0x6FC307B0` (`ITEMS_DispatchNormalItemModsByFormat`):
 * Dispatches Normal-quality item finalization (`0x6FC30600` Classic vs `0x6FC30550` Expansion).
 */
export function ITEMS_CheckSetItemEligibility113c(
  m: Memory113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
): number {
  if (!isSgptDataTablesLoaded113c(m)) return 0
  const u2 = arg2 >>> 0
  if (u2 >= 0x1000 && m.u32(u2) === UNIT_ITEM) {
    ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c(m, arg1 >>> 0, u2, arg3 | 0)
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FC30A20` (`ITEMS_GenerateMagicOrRareAffixes`):
 * Generates item quality (`1..9`), Magic/Rare/Set/Unique/Superior/LowQ/Crafted/Tempered affixes and stats,
 * failed Unique (`3x` dur) / Set (`2x` dur) downgrades, Ethereal (`0x6FC2EBB0`), Sockets (`0x6FC2EC90`),
 * and class `wAutoPrefix` automods.
 */
export function ITEMS_GenerateMagicOrRareAffixes113c(
  m: Memory113c,
  pGame: number,
  ppItemOrItem: number,
  pItemDrop = 0,
): number {
  return ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c(m, pGame, ppItemOrItem, pItemDrop)
}

/**
 * `@va D2Game:0x6FC31070` (`ITEMS_InitCreatedItemStats`):
 * Initializes base stats (`STAT_GOLD`, `STAT_QUANTITY`, `STAT_ARMORCLASS`, `STAT_DURABILITY`,
 * `STAT_MAXDURABILITY`, weapon damage, `nInvGfxIdx`) and invokes `0x6FC30A20`.
 */
export function ITEMS_InitCreatedItemStats113c(
  m: Memory113c,
  pGame: number,
  ppItemOrItem: number,
  ilvlOrDrop = 1,
  bGenerateQualityMods = 1,
): number {
  if (ppItemOrItem === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) {
    const pItemData = m.get(ppItemOrItem, D2UnitStrc.pUnitData)
    if (pItemData !== 0) {
      m.setU32(pItemData + 0x2c, ilvlOrDrop >>> 0)
    }
    return 1
  }
  const dropCand = ilvlOrDrop >>> 0
  if (dropCand >= 0x1000) {
    return ITEMS_InitCreatedItemStats_6FC31070_113c(
      m,
      pGame,
      ppItemOrItem,
      dropCand,
      bGenerateQualityMods,
    )
  }
  if (m.u32(ppItemOrItem >>> 0) === UNIT_ITEM) {
    const pItemData = m.get(ppItemOrItem, D2UnitStrc.pUnitData)
    if (pItemData !== 0) {
      m.setU32(pItemData + 0x2c, ilvlOrDrop >>> 0)
    }
    return ITEMS_InitCreatedItemStats_6FC31070_113c(m, pGame, ppItemOrItem, 0, 0)
  }
  return ITEMS_InitCreatedItemStats_6FC31070_113c(
    m,
    pGame,
    ppItemOrItem,
    0,
    bGenerateQualityMods,
  )
}

/**
 * `@va D2Game:0x6FC31490` (`D2GAME_CreateItemEx` / `ITEMS_FinalizeCreatedItem`):
 * Creates and initializes a complete `UNIT_ITEM` from `D2ItemDropStrc` (`0x6FC31490`),
 * or finalizes replenish events on an already-allocated `UNIT_ITEM`.
 */
export function ITEMS_FinalizeCreatedItem113c(
  m: Memory113c,
  pGame: number,
  pDropOrItem: number,
  bForceSeed = 0,
): number {
  if (pDropOrItem === 0) return 0
  const ptr = pDropOrItem >>> 0
  const isExistingItemUnit =
    m.u32(ptr) === UNIT_ITEM && (m.u32((ptr + 0x14) >>> 0) >>> 0) >= 0x1000
  if (!isExistingItemUnit) {
    const created = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, ptr, bForceSeed)
    if (created === 0 && !isItemRatioTableLoaded113c(m) && (m.u32((ptr + 0x14) >>> 0) | 0) < 0) {
      return 1
    }
    return created
  }
  if (isSgptDataTablesLoaded113c(m)) {
    ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, pGame >>> 0, ptr)
    ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, pGame >>> 0, ptr)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC31880` (`ITEMS_CreateDroppedItemAtUnit` / `ITEMS_CreateItem`):
 * Creates a `UNIT_ITEM` (`dwUnitType = 4`), stepping `pGame->tSeed` (`+0xD0`/`+0xD4`) twice via
 * `SUNIT_InitUnitSeed` + `SUNIT_InitExtraItemSeed`, advancing `pGame->dwLastUnitId[4]`, and
 * running `D2GAME_CreateItemEx_6FC31490_113c` when `sgptDataTables` is hydrated.
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
  if (allocateUnitInMem && isSgptDataTablesLoaded113c(m) && isItemRatioTableLoaded113c(m)) {
    const pDrop = 0x6fd3f300
    m.fill(pDrop, 0x84, 0)
    m.setU32((pDrop + 0x08) >>> 0, pGame >>> 0)
    m.setU32((pDrop + 0x0c) >>> 0, ilvl >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, itemClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 4)
    m.setU16(
      (pDrop + 0x2a) >>> 0,
      m.u32(((pGame >>> 0) + 0x70) >>> 0) !== 0 ? 101 : 0,
    )
    m.setU32((pDrop + 0x30) >>> 0, quality >>> 0)
    const pCreated = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pDrop, 0) >>> 0
    if (pCreated !== 0) {
      return pCreated
    }
  }

  const gameSeedPtr = pGame + D2GameStrc.seedLo.off
  const unitInitSeed = stepSeedInMem113c(m, gameSeedPtr)
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
  m.set(pItem, D2UnitStrc.dwAnimMode, 3)
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
 * `@va D2Game:0x6FC33DE0` (`ITEMS_RollStaffModsOnItem` / ground placement helper):
 * Rolls class staffmods (`+1..+3` individual class skills) on `pItem` (`0x6FC33DE0`),
 * or places `pItem` on ground at `(x, y)` in `pRoom` when coordinates are supplied.
 */
export function ITEMS_SpawnDroppedItemAtCoords113c(
  m: Memory113c,
  a1: number,
  a2 = 0,
  a3 = 0,
  x = 0,
  y = 0,
): number {
  if ((x | 0) !== 0 || (y | 0) !== 0) {
    const pItem = a3 >>> 0
    if (pItem === 0) return 0
    if (a2 !== 0 && isSgptDataTablesLoaded113c(m)) {
      ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(m, y | 0, pItem, a2 >>> 0, a1 >>> 0, 0, x | 0)
      return pItem
    }
    m.set(pItem, D2UnitStrc.dwAnimMode, 3)
    let pStaticPath = m.get(pItem, D2UnitStrc.pPath)
    if (pStaticPath === 0) {
      pStaticPath = m.alloc(0x20)
      m.set(pItem, D2UnitStrc.pPath, pStaticPath)
    }
    m.setU32(pStaticPath + 0x00, a2 >>> 0)
    m.setU32(pStaticPath + 0x04, x >>> 0)
    m.setU32(pStaticPath + 0x08, y >>> 0)
    return pItem
  }

  let pItem = 0
  let pDrop = 0
  const u1 = a1 >>> 0
  const u2 = a2 >>> 0
  const u3 = a3 >>> 0
  if (u1 >= 0x1000 && m.u32(u1) === UNIT_ITEM) {
    pItem = u1
    pDrop = u2 !== 0 ? u2 : u3
  } else if (u3 >= 0x1000 && m.u32(u3) === UNIT_ITEM) {
    pItem = u3
    pDrop = u2
  } else if (u2 >= 0x1000 && m.u32(u2) === UNIT_ITEM) {
    pItem = u2
    pDrop = u1
  }
  if (pItem !== 0 && pDrop !== 0) {
    ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, pItem, pDrop)
  }
  return pItem
}

/**
 * `@va D2Game:0x6FC51000` (`OBJECTS_FindFreeDropCoordsAndSpawnItem`):
 * Spiral-searches free subtile coordinates (`0x6FC2E930` / `COLLISION_FindFreePositionBasic`)
 * and places `pItem` (or spawns preset objects) in the target room.
 */
export function OBJECTS_FindFreeDropCoordsAndSpawnItem113c(
  m: Memory113c,
  pGame: number,
  pSourceUnit: number,
  pItem: number,
  nMode = 0,
  pOut = 0,
  bFlag = 0,
): number {
  return OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(
    m,
    pGame,
    pSourceUnit,
    pItem,
    nMode,
    pOut,
    bFlag,
  )
}

/**
 * `@va D2Game:0x6FC2E930` (`ITEMS_FindFreeGroundDropCoords` / gold pile drop helper):
 * Finds free ground drop coordinates (`0x6FC2E930`) when invoked with `(pRoom, pCenter, pOut, bFlag)`,
 * or spawns a `'gld '` (`classId = 523`) ground item at `pMonster`.
 */
export function ITEMS_DropGoldPileAtUnit113c(
  m: Memory113c,
  a1: number,
  a2: number,
  a3 = 256,
  a4: boolean | number = true,
): number {
  if (typeof a4 === 'boolean' && (a3 >>> 0) >= 0x1000) {
    return ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, a1, a2, a3, a4 ? 1 : 0)
  }
  if (a3 === 0 && a4 === false && isItemRatioTableLoaded113c(m)) {
    if (a2 === 0) return 0
    const pRoom = UNITS_GetRoom113c(m, a2) >>> 0
    if (pRoom === 0) return 0
    const pos = getUnitCoordsInMem113c(m, a2)
    const scratch = 0x6fd3f388
    m.setU32(scratch, pos.x >>> 0)
    m.setU32(scratch + 4, pos.y >>> 0)
    return ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pRoom, scratch, scratch + 8, 1)
  }
  if (a1 === 0 || a2 === 0) return 0
  if (isSgptDataTablesLoaded113c(m) && a4 !== false && a4 !== 0) {
    const pGold = ITEMS_CreateDroppedItemAtUnit_6FC31880_113c(m, a2, a1, 523, 2, 0, 0) >>> 0
    if (pGold !== 0 && (a3 | 0) !== 256) {
      const baseGold = STATLIST_GetUnitStat113c(m, pGold, STAT_GOLD_113C, 0) | 0
      const scaled = Math.max(1, ((a3 | 0) * baseGold) >> 8)
      STATLIST_SetUnitStat113c(m, pGold, STAT_GOLD_113C, scaled, 0)
    }
    return pGold
  }

  const alloc = a4 !== false && a4 !== 0
  const ilvl = ITEMS_GetDropItemLevel113c(m, a1, a2, m.get(a2, D2UnitStrc.pAct))
  const pItem = ITEMS_CreateItem113c(m, a1, 523, ilvl, 2, alloc)
  if (alloc && pItem !== 0) {
    const itemSeedPtr = pItem + D2UnitStrc.seedLo.off
    const baseLimit = ilvl * 6
    const baseRoll = baseLimit > 0 ? SEED_RollLimitedRandomNumber113c(m, itemSeedPtr, baseLimit) + 1 : 1
    const goldQty = Math.max(1, ((a3 | 0) * baseRoll) >> 8)
    STATLIST_SetUnitStat113c(m, pItem, STAT_GOLD_113C, goldQty, 0)
    OBJECTS_FindFreeDropCoordsAndSpawnItem113c(m, a1, a2, pItem)
  }
  return pItem
}

function stepUnbootstrappedSyntheticTc113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  allocateUnitInMem: boolean,
): number {
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiff113c(m, pGame)
  const tcName = row !== undefined ? row.tc[diff * 4] : 'Act 1 H2H A'
  if (tcName.length === 0) return 0
  const monSeed: D2SeedStrc = {
    lo: m.get(pMonster, D2UnitStrc.seedLo) >>> 0,
    hi: m.get(pMonster, D2UnitStrc.seedHi) >>> 0,
  }
  const firstRoll = seedRoll(monSeed, 160)
  m.set(pMonster, D2UnitStrc.seedLo, monSeed.lo >>> 0)
  m.set(pMonster, D2UnitStrc.seedHi, monSeed.hi >>> 0)
  if (firstRoll >= 100 && firstRoll < 124) {
    ITEMS_DropGoldPileAtUnit113c(m, pGame, pMonster, 256, allocateUnitInMem)
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FC32380` (`ITEMS_ChooseTreasureClassAndDrop`):
 * Evaluates the `TreasureClassEx` binary DAG on `pMonster->tSeed` (`+0x20`/`+0x24`), rolls item quality
 * (`0x6FC2FC40`), and spawns real `UNIT_ITEM` ground drops (`0x6FC31880 -> 0x6FC31490`) in `Memory113c`.
 */
export function ITEMS_ChooseTreasureClassItem113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  tcIdOrRec = -1,
  allocateUnitInMem = false,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  if (isSgptDataTablesLoaded113c(m)) {
    if ((tcIdOrRec >>> 0) >= 0x1000) {
      return ITEMS_ChooseTreasureClassAndDrop_6FC32380_113c(
        m,
        pGame,
        pMonster,
        pKiller,
        tcIdOrRec >>> 0,
        2,
        0,
        0,
        0,
        0,
      )
    }
    if (tcIdOrRec > 0) {
      const ilvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame, pMonster, 0)
      return ITEMS_DropMonsterTreasure_6FC32D60_113c(
        m,
        pGame,
        pMonster,
        pKiller,
        tcIdOrRec & 0xffff,
        0,
        ilvl,
      )
    }
    return MONSTER_DropTreasureOnDeath_6FC95680_113c(m, pGame, pMonster, pKiller)
  }
  return stepUnbootstrappedSyntheticTc113c(m, pGame, pMonster, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC32D60` (`ITEMS_DropMonsterTreasure`):
 * Resolves the monster's `TreasureClassEx` record from `MonStats.txt` / `SuperUniques.txt`
 * (Normal, Champion, Unique, Quest) and invokes `0x6FC32380`.
 */
export function ITEMS_DropMonsterTreasure113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  allocateUnitInMem = false,
  wTcId = -1,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  if (isSgptDataTablesLoaded113c(m)) {
    if (wTcId > 0) {
      const ilvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame, pMonster, 0)
      return ITEMS_DropMonsterTreasure_6FC32D60_113c(
        m,
        pGame,
        pMonster,
        pKiller,
        wTcId & 0xffff,
        0,
        ilvl,
      )
    }
    return MONSTER_DropTreasureOnDeath_6FC95680_113c(m, pGame, pMonster, pKiller)
  }
  return stepUnbootstrappedSyntheticTc113c(m, pGame, pMonster, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC95680` (`MONSTER_DropTreasureOnDeath`):
 * Resolves killer / mercenary owner, handles `Countess` / `Council` / `Izual` / `Radament` /
 * `Cow King` special drops, and invokes `ITEMS_DropMonsterTreasure_6FC32D60_113c`.
 */
export function MONSTER_DropTreasureOnDeath113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  allocateUnitInMem = false,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  if (isSgptDataTablesLoaded113c(m)) {
    return MONSTER_DropTreasureOnDeath_6FC95680_113c(m, pGame, pMonster, pKiller)
  }
  return stepUnbootstrappedSyntheticTc113c(m, pGame, pMonster, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC95900` (`MONSTER_DropDeathItems`):
 * Checks monster summon/no-loot flags (`0x820`, `MONSTATS +0x1A6`, `dwFlags & 0x10000800`) on death
 * and calls `MONSTER_DropTreasureOnDeath_6FC95680_113c` (`0x6FC95680`).
 */
export function MONSTER_DropDeathItems113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  allocateUnitInMem = false,
): number {
  if (pGame === 0 || pMonster === 0) return 0
  if (isSgptDataTablesLoaded113c(m)) {
    return MONSTER_DropDeathItems_6FC95900_113c(m, pGame, pMonster, pKiller)
  }
  return stepUnbootstrappedSyntheticTc113c(m, pGame, pMonster, allocateUnitInMem)
}

/**
 * `@va D2Game:0x6FC32EE0` (`ITEMS_ApplyItemDurabilityLoss`):
 * Full `0x6FC32EE0` (`666B`) implementation: rolls `SEED_RollLimitedRandomNumber(pItem->tSeed, 10)`
 * (`50` for missile weapons), decrements `STAT_DURABILITY (72)`, sends `0x3E` stat update, and breaks
 * zero-durability items via `0x6FCF5740`.
 */
export function ITEMS_ApplyItemDurabilityLoss113c(
  m: Memory113c,
  pGame: number,
  pOwner: number,
  pItem: number,
  isMissileWeapon = 0,
): number {
  if (pItem === 0) return 0
  if (isSgptDataTablesLoaded113c(m)) {
    return ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c(m, pGame, pOwner, pItem)
  }
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
// 2–3. MONSTER AI, MODE & DEATH CHAIN RE-EXPORTED FROM `k2-real-s2c-combat-113c.ts`
// ============================================================================

// ============================================================================
// 4. PLAYER MODE DISPATCH: MELEE ATTACK, SKILL, CAST & SHIELD BLOCK (`0x6FC978A0 .. 0x6FC99170`)
// ============================================================================

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
// 5. CANONICAL SUNITDMG RE-EXPORTS FROM `k2-real-s2c-combat-113c.ts`
// ============================================================================

setK2MonsterDropLootHook113c((m, pGame, pMonster, pKiller, allocateLootUnitInMem) => {
  if (!isSgptDataTablesLoaded113c(m) || isItemRatioTableLoaded113c(m)) {
    MONSTER_DropDeathItems113c(m, pGame, pMonster, pKiller, allocateLootUnitInMem)
  }
})

export {
  AI_DispatchTargetByAiFlag113c,
  AI_FindNearestPlayerOrAlly113c,
  AI_FindTargetScanRoomCallback113c,
  AI_FleeFrom113c,
  AI_GeneralFindTargetOrThrottle113c,
  AI_IdleWander113c,
  AI_RunMonsterAI113c,
  AI_Stall113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_ExpireMinionListsInAct113c,
  AiFallen113c,
  AiZombie113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_CheckSandLeaperMidAir113c,
  MONSTER_EndDeath113c,
  MONSTER_ExecuteEventsWrapper113c,
  MONSTER_SetDeathPathAndAnim113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  PLAYER_AdvanceSkillModeFrame113c,
  PLAYER_ScheduleAttackActionFrameEvents113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartBlockMode113c,
  PLAYER_StartModeCast113c,
  PLAYER_StartModeDispatch113c,
  PLAYER_StartModeSkill113c,
  ROOM_RecordMonsterDeath113c,
  SUNITDMG_AddDemonDamageBonus113c,
  SUNITDMG_AddLeechedLifeToUnit113c,
  SUNITDMG_AddMonsterTypeDamageBonus113c,
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyArmorDurabilityAndGetHit113c,
  SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c,
  SUNITDMG_ApplyAttackerThornsToSelf113c,
  SUNITDMG_ApplyColdChilledEffect113c,
  SUNITDMG_ApplyColdOrFreezeState113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyElementalAbsorb113c,
  SUNITDMG_ApplyFreezeEffect113c,
  SUNITDMG_ApplyLifeManaSteal113c,
  SUNITDMG_ApplyPoisonEffect113c,
  SUNITDMG_ApplyResistancesAndAbsorb113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ApplySingleChannelResistance113c,
  SUNITDMG_ApplyStunEffect113c,
  SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c,
  SUNITDMG_CalcMonsterExperience113c,
  SUNITDMG_CheckMonTypeFlag113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_ComputeExperienceGain113c,
  SUNITDMG_ComputeWeaponBaseDamage113c,
  SUNITDMG_ConsumeManaCost113c,
  SUNITDMG_ConsumeStaminaCost113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_ExecuteSingleHit113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_GetAttackerDamageData113c,
  SUNITDMG_GetColdEffectLengthBonus113c,
  SUNITDMG_GetEffectiveResistance113c,
  SUNITDMG_GetPlayerClientClassId113c,
  SUNITDMG_GetPvpOrPetDamageMultiplier113c,
  SUNITDMG_GetTotalSkillDamageBonus113c,
  SUNITDMG_PrependCombatNode113c,
  SUNITDMG_RemoveCombatNode113c,
  SUNITDMG_ResolveAttackerPlayer113c,
  SUNITDMG_RollDamageValue113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollElementalStatDamage113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  SUNITDMG_SelectDeathOverlayFlag113c,
  SUNITDMG_TriggerAttackerBlindOrFlee113c,
  SUNITDMG_TriggerBlockEvents113c,
  SUNITDMG_TriggerGetHitStateAndMode113c,
  SUNITDMG_TriggerPostCombatEvents113c,
}
