/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 4 Batch 1 (`w4b1`) routines across
 * `0x6FC21F60..0x6FC531B0` (45 functions).
 */

import {
  COLLISION_CheckMaskWithSizeXY113c,
  COLLISION_FindFreePositionBasic113c,
  COLLISION_ResetMaskWithPattern113c,
} from '../common/collision.js'
import { UNITS_SetObjectShrineTxt113c } from '../common/composit.js'
import { SEED_GetLowSeed113c } from '../common/drlg/drlg-grid.js'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.js'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.js'
import { D2CommonAssertError } from '../common/inline-helpers.js'
import { imul32, sdiv32 } from '../common/int-math.js'
import { ITEMS_CheckItemFlagCompactSaveByClassId113c } from '../common/inventory.js'
import {
  ITEMS_ApplyItemQualityMods113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetMagicPrefix113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOwnerGuid113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from '../common/items.js'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.js'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetCollisionMask113c,
  PATH_SetMoveTestCollisionMask113c,
} from '../common/path.js'
import { SKILLS_SetParam0C113c } from '../common/skills.js'
import {
  ITEMS_SetItemCell113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.js'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AllocStaticPath113c,
  UNITS_GetRoom113c,
  UNIT_Alloc113c,
} from '../common/unit.js'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.js'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.js'
import { SEED_InitLowSeed113c, seedRoll } from '../prng.js'
import {
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetMagicAffixTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecord113c,
  ITEMS_CheckIfUnique113c,
} from '../tables/datatbls-113c.js'
import { DATATBLS_GetItemIdFromItemCode113c } from '../tables/item-tbls-113c.js'
import {
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
} from './ai-fallen-113c.js'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c,
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c,
} from './k2-real-itemdrop-113c.js'
import { SUNIT_GetServerUnit113c } from './game-strc.js'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_CreateServerProjectile113c,
  SEED_RollRangeWithMinFast113c,
} from './k2-gap-melee-dot-113c.js'
import {
  AI_CheckAnyMinionDeadCallback113c,
  type K2ItemsTcW1Hooks113c,
  MONUMOD_ApplyToMinionCallback113c,
  MONUMOD_GetConstantValue113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
  OBJECTS_SubstituteObjectClassIdFromParm0_113c,
} from './k2-items-tc-w1-113c.js'
import {
  MONLVL_GetRecordPtrFast_6FC21E90_113c,
  OBJRGN_CheckCoordSpacing20_6FC2B700_113c,
  OBJRGN_CheckCoordSpacing40_6FC2B670_113c,
} from './k2-laneH-0x6fc2-w1-113c.js'
import {
  AIGENERAL_ForEachPackMember_6FC41490_113c,
  AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c,
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  ITEMS_SpawnItemWithParams_6FC31980_113c,
  ITEMS_TestUniqueSpawnedBit_6FC2E250_113c,
  type LaneIHooks113c,
  MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c,
  MONUMOD_ApplyExtraFastVelocity_6FC42880_113c,
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c,
  type PackMemberCallbackFn113c,
} from './k2-laneI-0x6fc3-w1-113c.js'
import {
  MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c,
  OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c,
} from './k2-laneJ-0x6fc4-w1-113c.js'
import {
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  MONSTER_AssignTeleportSkill_6FC441B0_113c,
} from './k2-w10b1-113c.js'
import { SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c } from './k2-w2b8-113c.js'
import {
  AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c,
  ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c,
  ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c,
  ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c,
  ITEMS_ApplyLowQualityItemMods_6FC337F0_113c,
  ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c,
  ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c,
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_RollAndApplyUniqueItem_6FC33C20_113c,
  ITEMS_RollAutoMagicAffixId_6FC348A0_113c,
  ITEMS_RollMagicAffixId_6FC344D0_113c,
  ITEMS_RollRarePrefixId_6FC34210_113c,
  ITEMS_RollRareSuffixId_6FC34370_113c,
  ITEMS_RollSpawnableArmorId_6FC2FA30_113c,
  ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c,
  ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c,
  type K2W3B1Hooks113c,
  STORM_TSListDestroy_6FC21FE0_113c,
} from './k2-w3b1-113c.js'
import {
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c,
  GAME_LookupAndLockGameByKey_6FC4AAE0_113c,
  type K2W3B2Hooks113c,
  MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c,
  MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c,
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c,
  MONUMOD_ApplyGhostlyStats_6FC42D00_113c,
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c,
  MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c,
  MONUMOD_CheckModEligibility_6FC43100_113c,
  MONUMOD_SpawnBossMinionPack_6FC445A0_113c,
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c,
  OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c,
  OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c,
  OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c,
  OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c,
  OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c,
} from './k2-w3b2-113c.js'
import { SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c } from './k2-w3b4-113c.js'
import {
  UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c,
  UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c,
} from './k2-w3b8-113c.js'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events.js'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.js'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  OBJECTS_PickShrineIdFromControlGroup113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SEED_RollMaskFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.js'
import {
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
} from './replay-kernel-113c.js'
import { MONSTER_RefreshAiEvent113c } from './timer-wheel.js'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c.js'
import { hitD2GameVa113c } from '../va-trace-113c.js'

export type D2KernMemory113c = Memory113c

export interface K2W4B1Hooks113c {
  readonly itemsTc?: K2ItemsTcW1Hooks113c
  readonly laneI?: LaneIHooks113c
  readonly meleeDot?: K2GapMeleeDotHooks113c
  readonly w3b1?: K2W3B1Hooks113c
  readonly w3b2?: K2W3B2Hooks113c
}

let k2W4B1StackPtr = 0x7e0b0000

function sx16(v: number): number {
  return (v << 16) >> 16
}

function readSgptDataTables113c(m: D2KernMemory113c): number {
  return m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
}

function readGdwBitMasks113c(m: D2KernMemory113c, nBitIndex: number): number {
  const pTable = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  if (pTable === 0) {
    return (1 << (nBitIndex & 31)) >>> 0
  }
  return m.u32((pTable + ((nBitIndex & 31) << 2)) >>> 0) >>> 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 0x04) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 0x04) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

function rollSeedPtrViaSeedRoll113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  if (addr === 0) return 0
  const max = nMax | 0
  if (max <= 0) return 0
  const seed = { lo: m.u32(addr), hi: m.u32((addr + 0x04) >>> 0) }
  if (((max - 1) & max) === 0) {
    const raw = stepSeed64At113c(m, addr)
    return (raw & (max - 1)) >>> 0
  }
  const res = seedRoll(seed, max)
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 0x04) >>> 0, seed.hi >>> 0)
  return res >>> 0
}

function invokeMonsterStartMode113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
  pTarget: number,
  nSpeedByte: number,
): number {
  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0x24) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp + 0x00, nMode >>> 0)
    m.setU32(sp + 0x04, pUnit >>> 0)
    m.setU32(sp + 0x08, pTarget >>> 0)
    m.setU8(sp + 0x15, nSpeedByte & 0xff)
    const pPath = pUnit !== 0 ? m.u32(pUnit + 0x2c) >>> 0 : 0
    if (pPath === 0) {
      if (pUnit !== 0) {
        m.setU32(pUnit + 0x10, nMode >>> 0)
      }
      return 1
    }
    const fakeWorld = {
      m,
      pGame,
      pathUnitByPtr: new Map(),
    } as unknown as Parameters<typeof MONSTER_StartMode113c>[0]
    try {
      return MONSTER_StartMode113c(fakeWorld, pUnit, nMode, pTarget, 0, 0) ? 1 : 0
    } catch {
      m.setU32(pUnit + 0x10, nMode >>> 0)
      return 1
    }
  } finally {
    k2W4B1StackPtr = sp
  }
}

function invokeAiStall113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
): void {
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof AI_Stall113c>[0]
  try {
    AI_Stall113c(fakeWorld, pUnit, nDelay)
  } catch {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0x10, 1)
    }
  }
}

function invokeAiApproachTarget113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  targetX: number,
  targetY: number,
  nStepNum: number,
  nFlags: number,
): number {
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof AI_ApproachTarget113c>[0]
  try {
    return AI_ApproachTarget113c(
      fakeWorld,
      pUnit,
      pTarget,
      nMode,
      targetX,
      targetY,
      nStepNum,
      nFlags,
    )
      ? 1
      : 0
  } catch {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0x10, nMode >>> 0)
    }
    return 0
  }
}

/**
 * [1/45] SEH destructor wrapper around `STORM_TSListDestroy_6FC21FE0_113c` (`ret 4`).
 *
 * @va D2Game:0x6FC21F60
 */
export function STORM_TSListDestroySehWrapper_6FC21F60_113c(
  m: D2KernMemory113c,
  pList: number,
): void {
  hitD2GameVa113c(0x6FC21F60)
  STORM_TSListDestroy_6FC21FE0_113c(m, pList)
}

/**
 * [2/45] Binds `pTargetUnit` onto dynamic unit `pUnit` (`edx`) and executes Corpse Explosion (`0x11D`)
 * via `SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c`.
 *
 * @va D2Game:0x6FC2C8D0
 */
export function SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTargetUnit: number,
  nSkillLevel: number,
  _dwUnused = 0,
): number {
  hitD2GameVa113c(0x6FC2C8D0)
  UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, pTargetUnit)
  return SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c(m, pGame, pUnit, 0x11d, nSkillLevel)
}

/**
 * [3/45] Monster skill do-handler that marks validated target `pTarget` with state `0x76` (`118`),
 * spawns `wSrvMissileA` from the pack leader (`AIGENERAL_GetPackLeaderUnit113c`) aimed at `pTarget`,
 * and queues `S2C_AURA_TARGET_FX` (`0xA3`).
 *
 * @va D2Game:0x6FC2D170
 */
export function SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2W4B1Hooks113c,
): number {
  hitD2GameVa113c(0x6FC2D170)
  const unit = pUnit >>> 0
  if (unit === 0 || m.u32(unit) !== 1) {
    return 0
  }
  const skillId = nSkillId | 0
  if (skillId < 0) {
    return 0
  }
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
    return 0
  }
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  const wSrvMissileA = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  if (wSrvMissileA <= 0 || wSrvMissileA >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
    return 0
  }
  const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, unit) >>> 0
  if (pLeader === 0) {
    return 0
  }
  const game = pGame >>> 0
  const pTarget = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, unit, game) >>> 0
  if (pTarget === 0) {
    return 0
  }
  if (STATES_CheckState113c(m, pTarget, 0x76) !== 0) {
    return 0
  }
  STATES_ToggleGfxStateFlag113c(m, pTarget, 0x76, 1)
  UNITROOM_RefreshUnit113c(m, pTarget)

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0x60) >>> 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32((sp + 0x04) >>> 0, pLeader)
    m.setU32((sp + 0x08) >>> 0, pTarget)
    m.setU32((sp + 0x10) >>> 0, wSrvMissileA >>> 0)
    m.setU32((sp + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((sp + 0x30) >>> 0, nSkillLevel >>> 0)
    MISSILE_CreateServerProjectile113c(
      m,
      game,
      sp,
      hooks !== undefined ? hooks.meleeDot : undefined,
    )
  } finally {
    k2W4B1StackPtr = sp
  }

  UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(m, unit, pTarget, skillId, 1, 0, 0, 0)
  return 1
}

/**
 * [4/45] Selects and applies a `UniqueItemsTxt` record to `pItem` (`[esp+8]`) from `pItemDrop`
 * (`[esp+0xC]`) in `pGame` (`[esp+4]`), scaling pre-v1.07 durability by 5x (`<= 255`), handling
 * forced unique indices or weighted rarity rolls (`0x6FD31FA0`), and applying quality `3` mods.
 *
 * @va D2Game:0x6FC2F370
 */
export function ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c(
  m: D2KernMemory113c,
  pGame: number,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC2F370)
  const item = pItem >>> 0
  const game = pGame >>> 0
  const drop = pItemDrop >>> 0
  const nItemId = item !== 0 ? m.u32((item + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) {
    return 0
  }

  const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
  if (ITEMS_CanItemLoseDurability113c(m, item) !== 0 && wFormat === 0) {
    const curDur = STATLIST_GetUnitStat113c(m, item, 0x48, 0) | 0
    const maxDur = STATLIST_GetUnitBaseStat113c(m, item, 0x49, 0) | 0
    let scaledCur = imul32(curDur, 5)
    if (scaledCur >= 0xff) scaledCur = 0xff
    STATLIST_SetUnitStat113c(m, item, 0x48, scaledCur, 0)
    let scaledMax = imul32(maxDur, 5)
    if (scaledMax >= 0xff) scaledMax = 0xff
    STATLIST_SetUnitStat113c(m, item, 0x49, scaledMax, 0)
  }

  const pDataTables = readSgptDataTables113c(m)
  if (m.u32((drop + 0x2c) >>> 0) !== 0) {
    const forcedId = m.u32((drop + 0x40) >>> 0) | 0
    if (forcedId < 0 || pDataTables === 0) {
      return 0
    }
    const nUniqueCount = m.u32((pDataTables + 0xc28) >>> 0) | 0
    if (forcedId >= nUniqueCount) {
      return 0
    }
    const pUniqueBase = m.u32((pDataTables + 0xc24) >>> 0) >>> 0
    const pUniqueTxt = (pUniqueBase + imul32(forcedId, 0x14c)) >>> 0
    if (pUniqueTxt === 0) {
      return 0
    }
    ITEMS_SetItemCell113c(m, item, forcedId)
    if (m.u32((pUniqueTxt + 0x28) >>> 0) === m.u32((pItemsTxt + 0x80) >>> 0)) {
      ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
      ITEMS_ApplyItemQualityMods113c(m, 3, 0, item, 0, 0, 0)
    }
    return 1
  }

  if (pDataTables === 0) {
    return 0
  }
  const pUniqueBase = m.u32((pDataTables + 0xc24) >>> 0) >>> 0
  if (wFormat === 0) {
    const nUniqueCount = m.u32((pDataTables + 0xc28) >>> 0) | 0
    if (nUniqueCount <= 0) {
      return 0
    }
    for (let i = 0; i < nUniqueCount; i = (i + 1) | 0) {
      const pRec = (pUniqueBase + imul32(i, 0x14c)) >>> 0
      if (m.u16((pRec + 0x24) >>> 0) >= 0x64) {
        continue
      }
      const flags = m.u8((pRec + 0x2c) >>> 0)
      if ((flags & readGdwBitMasks113c(m, 0)) === 0) {
        continue
      }
      if (
        m.u8((game + 0x6a) >>> 0) === 0 &&
        m.u32((game + 0x74) >>> 0) === 0 &&
        (flags & readGdwBitMasks113c(m, 3)) !== 0
      ) {
        continue
      }
      if (m.u32((pItemsTxt + 0x80) >>> 0) !== m.u32((pRec + 0x28) >>> 0)) {
        continue
      }
      if (
        ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, game, i) !== 0 &&
        m.u8((pItemsTxt + 0x12a) >>> 0) === 0
      ) {
        continue
      }
      ITEMS_SetItemCell113c(m, item, i)
      ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
      ITEMS_ApplyItemQualityMods113c(m, 3, 0, item, 0, 0, 0)
      return 1
    }
    return 0
  }

  const nUniqueCount = m.u32((pDataTables + 0xc28) >>> 0) | 0
  let matchCount = 0
  let totalRarity = 0
  let forcedMatchIdx = -1
  for (let i = 0; i < nUniqueCount; i = (i + 1) | 0) {
    const pRec = (pUniqueBase + imul32(i, 0x14c)) >>> 0
    if (m.u16((pRec + 0x24) >>> 0) >= 0x64 && wFormat < 0x64) {
      continue
    }
    const flags = m.u8((pRec + 0x2c) >>> 0)
    if ((flags & readGdwBitMasks113c(m, 0)) === 0) {
      continue
    }
    if (m.u32((pItemsTxt + 0x80) >>> 0) !== m.u32((pRec + 0x28) >>> 0)) {
      continue
    }
    if (
      m.u8((game + 0x6a) >>> 0) === 0 &&
      m.u32((game + 0x74) >>> 0) === 0 &&
      (flags & readGdwBitMasks113c(m, 3)) !== 0
    ) {
      continue
    }
    const ilvl = ITEMS_GetItemLevel113c(m, item) | 0
    if (sx16(m.u16((pRec + 0x34) >>> 0)) > ilvl) {
      continue
    }
    const argIndex = m.u32((drop + 0x40) >>> 0) >>> 0
    if (argIndex > 0 && ((argIndex - 1) | 0) === i) {
      forcedMatchIdx = i
    }
    m.setU32((0x6fd31fa0 + matchCount * 8) >>> 0, i >>> 0)
    m.setU32((0x6fd31fa4 + matchCount * 8) >>> 0, totalRarity >>> 0)
    let rarity = m.u32((pRec + 0x30) >>> 0) | 0
    if (rarity < 1) {
      rarity = 1
    }
    totalRarity = (totalRarity + rarity) | 0
    matchCount = (matchCount + 1) | 0
  }

  if (matchCount <= 0) {
    if (ITEMS_CheckIfUnique113c(m, item) !== 0) {
      return 1
    }
    ITEMS_SetItemCell113c(m, item, -1)
    return 0
  }

  let chosenIdx = forcedMatchIdx
  if (chosenIdx < 0) {
    const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
    const roll = SEED_RollRangeWithMinFast113c(m, pSeed, 0, totalRarity) | 0
    let k = 1
    while (k < matchCount && roll >= (m.u32((0x6fd31fa4 + k * 8) >>> 0) | 0)) {
      k = (k + 1) | 0
    }
    chosenIdx = m.u32((0x6fd31f98 + k * 8) >>> 0) | 0
  }

  if (m.u8((pItemsTxt + 0x12a) >>> 0) === 0) {
    if (ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, game, chosenIdx) !== 0) {
      ITEMS_SetItemCell113c(m, item, -1)
      return 0
    }
  }

  const curUniqueCount = m.u32((pDataTables + 0xc28) >>> 0) | 0
  if (chosenIdx < 0 || chosenIdx >= curUniqueCount) {
    return 0
  }
  const curUniqueBase = m.u32((pDataTables + 0xc24) >>> 0) >>> 0
  const pChosenRec = (curUniqueBase + imul32(chosenIdx, 0x14c)) >>> 0
  if (pChosenRec === 0 || m.u32((pItemsTxt + 0x80) >>> 0) !== m.u32((pChosenRec + 0x28) >>> 0)) {
    return 0
  }

  ITEMS_SetItemCell113c(m, item, chosenIdx)
  if (ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c(m, game, item) === 0) {
    ITEMS_SetItemCell113c(m, item, -1)
    return 0
  }
  ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
  ITEMS_ApplyItemQualityMods113c(m, 3, 0, item, 0, 0, 0)
  return 1
}

/**
 * [5/45] Rolls a level-weighted item classId across gold (`'gld '`), armor (`0x6FC2FA30`),
 * weapons (`0x6FC2F8F0`), or misc (`0x6FC2F780`) for `nLevelId` (`<= 0x41`).
 *
 * @va D2Game:0x6FC2FFC0
 */
export function ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(
  m: D2KernMemory113c,
  pSeed: number,
  nLevelId: number,
  pGame: number,
  nRequiredType: number,
  bSkipRarityRoll: number,
  bAllowQuest0x28: number,
): number {
  hitD2GameVa113c(0x6FC2FFC0)
  let goldId: number
  if ((m.u8(0x6fd39fa4) & 1) === 0) {
    m.setU32(0x6fd39fa4, (m.u32(0x6fd39fa4) | 1) >>> 0)
    goldId = DATATBLS_GetItemIdFromItemCode113c(m, 0x20646c67) | 0
    m.setU32(0x6fd39fa0, goldId >>> 0)
  } else {
    goldId = m.u32(0x6fd39fa0) | 0
  }

  if (goldId === -1) {
    throw new D2CommonAssertError('Items.cpp', 0x17c)
  }
  if (goldId === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x17f)
  }
  const lvl = nLevelId | 0
  if (lvl > 0x41) {
    throw new D2CommonAssertError('Items.cpp', 0x180)
  }

  const goldEnd = (0x41 - lvl) | 0
  const halfLvl = lvl >> 1
  const rem2 = lvl % 2
  const weapSpan = (halfLvl + 0x0a + (rem2 !== 0 ? 1 : 0)) | 0
  const armorEnd = (halfLvl + goldEnd + 5) | 0
  const weaponEnd = (armorEnd + weapSpan) | 0

  const newLo = stepSeed64At113c(m, pSeed)
  const roll = ((newLo >>> 0) % 100) | 0
  if (roll < goldEnd) {
    return m.u32(0x6fd39fa0) | 0
  }
  if (roll < armorEnd) {
    return ITEMS_RollSpawnableArmorId_6FC2FA30_113c(
      m,
      nRequiredType,
      pGame,
      pSeed,
      lvl,
      bSkipRarityRoll,
    )
  }
  if (roll < weaponEnd) {
    return ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(
      m,
      nRequiredType,
      pGame,
      pSeed,
      lvl,
      bSkipRarityRoll,
    )
  }
  if (roll < 100) {
    return ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c(
      m,
      pGame,
      pSeed,
      lvl,
      nRequiredType,
      bSkipRarityRoll,
      bAllowQuest0x28,
    )
  }
  throw new D2CommonAssertError('Items.cpp', 0x1ba)
}

/**
 * [6/45] Resets item affixes/cell (`0x6FC2E210`), sets owner GUID and low seed from `*pdwSeed`,
 * applies socket/ethereal bonuses (`0x6FC2EE90`), sets quality `3` (Superior), updates `*pdwSeed`,
 * and applies Superior mods (`0x6FC340B0`).
 *
 * @va D2Game:0x6FC301E0
 */
export function ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c(
  m: D2KernMemory113c,
  ppItem: number,
  pdwSeed: number,
  pItemDrop: number,
): void {
  hitD2GameVa113c(0x6FC301E0)
  const pp = ppItem >>> 0
  const pSeedVar = pdwSeed >>> 0
  const drop = pItemDrop >>> 0
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, pp)
  ITEMS_SetOwnerGuid113c(m, m.u32(pp), m.u32(pSeedVar))
  const pSeed1 = ITEMS_GetItemSeed113c(m, m.u32(pp)) >>> 0
  SEED_InitLowSeed113c(m, pSeed1, m.u32(pSeedVar))
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, m.u32(pp), drop)
  ITEMS_SetItemQuality113c(m, m.u32(pp), 3)
  m.setU32((drop + 0x30) >>> 0, 3)
  const pSeed2 = ITEMS_GetItemSeed113c(m, m.u32(pp)) >>> 0
  m.setU32(pSeedVar, SEED_GetLowSeed113c(m, pSeed2) >>> 0)
  const pItem = m.u32(pp) >>> 0
  ITEMS_GetItemFormat113c(m, pItem)
  ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(m, pItem, drop)
}

/**
 * [7/45] Rolls and assigns magic prefix and/or suffix onto `pItem` (`esi`) from `pItemDrop`
 * (`[esp+4]`), asserting at `Items.cpp:0x372` if both prefix and suffix roll `0`, and clearing
 * command flag `0x10`.
 *
 * @va D2Game:0x6FC30240
 */
export function ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC30240)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  let wPrefix = 0
  let wSuffix = 0
  let bForceSuffix = 0

  const forcedPrefix = m.u32((drop + 0x68) >>> 0) | 0
  if (forcedPrefix > 0) {
    const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
    if (wFormat >= 1) {
      wPrefix = ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 1, 1, forcedPrefix, 0) & 0xffff
    } else {
      wPrefix = ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 1, 1, 1, forcedPrefix) & 0xffff
    }
    ITEMS_SetMagicPrefix113c(m, item, wPrefix, 0)
  } else {
    const forcedSuffix0 = m.u32((drop + 0x74) >>> 0) | 0
    if (forcedSuffix0 <= 0) {
      const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
      let rolledPrefix: number
      if (wFormat >= 1) {
        rolledPrefix =
          ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 0, 1, 1, forcedSuffix0, 0) & 0xffff
      } else {
        rolledPrefix =
          ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 0, 1, 1, forcedSuffix0) & 0xffff
      }
      wSuffix = rolledPrefix
      ITEMS_SetMagicPrefix113c(m, item, rolledPrefix, 0)
      if ((rolledPrefix & 0xffff) === 0) {
        bForceSuffix = 1
      }
    }
  }

  const forcedSuffix = m.u32((drop + 0x74) >>> 0) | 0
  if (forcedSuffix > 0) {
    const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
    if (wFormat >= 1) {
      wSuffix = ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 1, 0, forcedSuffix, 0) & 0xffff
    } else {
      wSuffix = ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 1, 1, 0, forcedSuffix) & 0xffff
    }
    ITEMS_SetMagicSuffix113c(m, item, wSuffix, 0)
  } else {
    const forcedPrefix0 = m.u32((drop + 0x68) >>> 0) | 0
    if (forcedPrefix0 <= 0) {
      const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
      if (wFormat >= 1) {
        wPrefix =
          ITEMS_RollMagicAffixId_6FC344D0_113c(
            m,
            item,
            1,
            bForceSuffix,
            1,
            0,
            forcedPrefix0,
            0,
          ) & 0xffff
      } else {
        wPrefix =
          ITEMS_RollAutoMagicAffixId_6FC348A0_113c(
            m,
            item,
            1,
            bForceSuffix,
            1,
            0,
            forcedPrefix0,
          ) & 0xffff
      }
      ITEMS_SetMagicSuffix113c(m, item, wPrefix, 0)
    }
  }

  if ((wPrefix & 0xffff) === 0 && (wSuffix & 0xffff) === 0) {
    ITEMS_GetBaseCode113c(m, item)
    throw new D2CommonAssertError('Items.cpp', 0x372)
  }

  ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
  return 1
}

/**
 * [8/45] Rolls magic prefix/suffix onto `*ppItem` (`[esp+4]`) from `pItemDrop` (`[esp+8]`),
 * returning `0` if neither rolled, or clearing command flag `0x10` and invoking `0x6FC33DE0`.
 *
 * @va D2Game:0x6FC303C0
 */
export function ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(
  m: D2KernMemory113c,
  ppItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC303C0)
  const pp = ppItem >>> 0
  const drop = pItemDrop >>> 0
  let wPrefix = 0
  let wSuffix = 0
  let bForceSuffix = 0
  let bForcePrefix = 0

  const forcedPrefix = m.u32((drop + 0x68) >>> 0) | 0
  let doSuffix = true
  if (forcedPrefix < 0) {
    bForceSuffix = 1
  } else {
    if (forcedPrefix > 0) {
      bForcePrefix = 1
    }
    const pItem0 = m.u32(pp) >>> 0
    const wFormat0 = ITEMS_GetItemFormat113c(m, pItem0) & 0xffff
    if (wFormat0 >= 1) {
      wPrefix =
        ITEMS_RollMagicAffixId_6FC344D0_113c(
          m,
          pItem0,
          1,
          bForcePrefix,
          1,
          1,
          forcedPrefix,
          0,
        ) & 0xffff
    } else {
      wPrefix =
        ITEMS_RollAutoMagicAffixId_6FC348A0_113c(
          m,
          pItem0,
          1,
          bForcePrefix,
          1,
          1,
          forcedPrefix,
        ) & 0xffff
    }
    ITEMS_SetMagicPrefix113c(m, m.u32(pp), wPrefix, 0)
    if ((wPrefix & 0xffff) === 0) {
      bForceSuffix = 1
    } else if ((m.u32((drop + 0x74) >>> 0) | 0) < 0) {
      doSuffix = false
    }
  }

  if (doSuffix) {
    const forcedSuffix = m.u32((drop + 0x74) >>> 0) | 0
    if (forcedSuffix > 0) {
      bForceSuffix = 1
    }
    const pItem1 = m.u32(pp) >>> 0
    const wFormat1 = ITEMS_GetItemFormat113c(m, pItem1) & 0xffff
    if (wFormat1 >= 1) {
      wSuffix =
        ITEMS_RollMagicAffixId_6FC344D0_113c(
          m,
          pItem1,
          1,
          bForceSuffix,
          1,
          0,
          forcedSuffix,
          0,
        ) & 0xffff
    } else {
      wSuffix =
        ITEMS_RollAutoMagicAffixId_6FC348A0_113c(
          m,
          pItem1,
          1,
          bForceSuffix,
          1,
          0,
          forcedSuffix,
        ) & 0xffff
    }
    ITEMS_SetMagicSuffix113c(m, m.u32(pp), wSuffix, 0)
  }

  if ((wPrefix & 0xffff) === 0 && (wSuffix & 0xffff) === 0) {
    return 0
  }

  ITEMS_SetOrClearCommandFlags113c(m, m.u32(pp), 0x10, 0)
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(pp), drop)
  return 1
}

/**
 * [9/45] Rolls a misc item of `nRequiredType` via `0x6FC2F780`, finds a free drop subtile near
 * `pCoords` (`eax`), and creates the ground item via `D2GAME_CreateItemEx_6FC31490_113c`.
 *
 * @va D2Game:0x6FC31CA0
 */
export function ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(
  m: D2KernMemory113c,
  pCoords: number,
  pGame: number,
  pRoom: number,
  nRequiredType: number,
  bSkipRarityRoll: number,
  pOwnerUnit: number,
): number {
  hitD2GameVa113c(0x6FC31CA0)
  const room = pRoom >>> 0
  const game = pGame >>> 0
  const coords = pCoords >>> 0
  let mlvl = 1
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, room)
  if (nLevelId !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, room) === 0) {
    mlvl =
      DATATBLS_GetLevelMonsterLevel113c(
        m,
        nLevelId,
        m.u8((game + 0x6d) >>> 0),
        m.u32((game + 0x70) >>> 0),
      ) | 0
    if (mlvl > 1) {
      mlvl = (mlvl - 1) | 0
    }
  }

  const pRoomSeed = room !== 0 ? (room + 0x6c) >>> 0 : 0
  const owner = pOwnerUnit >>> 0
  const bAllowQuest0x28 = owner !== 0 && m.u32(owner) === 1 ? 1 : 0
  const nClassId = ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c(
    m,
    game,
    pRoomSeed,
    mlvl,
    nRequiredType,
    bSkipRarityRoll,
    bAllowQuest0x28,
  )

  const x0 = m.u32(coords) | 0
  const y0 = m.u32((coords + 0x04) >>> 0) | 0
  const xOff = (x0 + 2) | 0
  const yOff = (y0 + 3) | 0
  const pFoundRoom = ROOM_FindRoomContainingSubtile113c(m, room, xOff, yOff) >>> 0

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0xa8) >>> 0
  try {
    m.fill(sp, 0xa8, 0)
    const pOutCoords = sp
    const pCenterCoords = (sp + 0x08) >>> 0
    const pDrop = (sp + 0x18) >>> 0
    m.setU32(pCenterCoords, x0 >>> 0)
    m.setU32((pCenterCoords + 0x04) >>> 0, y0 >>> 0)
    if (pFoundRoom !== 0) {
      m.setU32(pOutCoords, xOff >>> 0)
      m.setU32((pOutCoords + 0x04) >>> 0, yOff >>> 0)
    } else {
      m.setU32(pOutCoords, x0 >>> 0)
      m.setU32((pOutCoords + 0x04) >>> 0, y0 >>> 0)
    }

    const pTargetRoom =
      COLLISION_FindFreePositionBasic113c(m, room, pOutCoords, pCenterCoords, 1, 0x3e01, 0x801, 1) >>> 0
    if (pTargetRoom === 0) {
      return 0
    }

    m.fill(pDrop, 0x84, 0)
    m.setU32((pDrop + 0x00) >>> 0, owner)
    m.setU32((pDrop + 0x04) >>> 0, pRoomSeed)
    m.setU32((pDrop + 0x08) >>> 0, game)
    m.setU32((pDrop + 0x0c) >>> 0, mlvl >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 3)
    m.setU32((pDrop + 0x1c) >>> 0, m.u32(pOutCoords))
    m.setU32((pDrop + 0x20) >>> 0, m.u32((pOutCoords + 0x04) >>> 0))
    m.setU32((pDrop + 0x24) >>> 0, pTargetRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, m.u16((game + 0x78) >>> 0))
    m.setU32((pDrop + 0x30) >>> 0, 0)
    return D2GAME_CreateItemEx_6FC31490_113c(m, game, pDrop, 0) | 0
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [10/45] Rolls up to 6 weapon classIds of `nRequiredType` via `0x6FC2F8F0` until one has
 * `ITEMS_CheckItemFlagCompactSaveByClassId113c != 0` (or 6 tries), finds a free subtile near
 * `pCoords`, and creates the ground item with drop flag `0x40`.
 *
 * @va D2Game:0x6FC31E20
 */
export function ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  pCoords: number,
  nRequiredType: number,
  bSkipRarityRoll: number,
  pOwnerUnit: number,
): number {
  hitD2GameVa113c(0x6FC31E20)
  const game = pGame >>> 0
  const room = pRoom >>> 0
  const coords = pCoords >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, room)
  let mlvl =
    DATATBLS_GetLevelMonsterLevel113c(
      m,
      nLevelId,
      m.u8((game + 0x6d) >>> 0),
      m.u32((game + 0x70) >>> 0),
    ) | 0
  if (mlvl > 1) {
    mlvl = (mlvl - 1) | 0
  }
  const pRoomSeed = room !== 0 ? (room + 0x6c) >>> 0 : 0

  let nClassId = -1
  for (let attempt = 0; attempt < 6; attempt = (attempt + 1) | 0) {
    nClassId =
      ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(
        m,
        nRequiredType,
        game,
        pRoomSeed,
        mlvl,
        bSkipRarityRoll,
      ) | 0
    if (nClassId >= 0 && ITEMS_CheckItemFlagCompactSaveByClassId113c(m, nClassId) !== 0) {
      break
    }
  }
  if (nClassId < 0) {
    return 0
  }

  const x0 = m.u32(coords) | 0
  const y0 = m.u32((coords + 0x04) >>> 0) | 0
  const xOff = (x0 + 2) | 0
  const yOff = (y0 + 3) | 0
  const pFoundRoom = ROOM_FindRoomContainingSubtile113c(m, room, xOff, yOff) >>> 0

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0xa8) >>> 0
  try {
    m.fill(sp, 0xa8, 0)
    const pOutCoords = sp
    const pCenterCoords = (sp + 0x08) >>> 0
    const pDrop = (sp + 0x18) >>> 0
    m.setU32(pCenterCoords, x0 >>> 0)
    m.setU32((pCenterCoords + 0x04) >>> 0, y0 >>> 0)
    if (pFoundRoom !== 0) {
      m.setU32(pOutCoords, xOff >>> 0)
      m.setU32((pOutCoords + 0x04) >>> 0, yOff >>> 0)
    } else {
      m.setU32(pOutCoords, x0 >>> 0)
      m.setU32((pOutCoords + 0x04) >>> 0, y0 >>> 0)
    }

    const pTargetRoom =
      COLLISION_FindFreePositionBasic113c(m, room, pOutCoords, pCenterCoords, 1, 0x3e01, 0x801, 1) >>> 0
    if (pTargetRoom === 0) {
      return 0
    }

    m.fill(pDrop, 0x84, 0)
    m.setU32((pDrop + 0x00) >>> 0, pOwnerUnit >>> 0)
    m.setU32((pDrop + 0x04) >>> 0, pRoomSeed)
    m.setU32((pDrop + 0x08) >>> 0, game)
    m.setU32((pDrop + 0x0c) >>> 0, mlvl >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 3)
    m.setU32((pDrop + 0x1c) >>> 0, m.u32(pOutCoords))
    m.setU32((pDrop + 0x20) >>> 0, m.u32((pOutCoords + 0x04) >>> 0))
    m.setU32((pDrop + 0x24) >>> 0, pTargetRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, m.u16((game + 0x78) >>> 0))
    m.setU32((pDrop + 0x30) >>> 0, 0)
    m.setU32((pDrop + 0x80) >>> 0, (m.u32((pDrop + 0x80) >>> 0) | 0x40) >>> 0)
    return D2GAME_CreateItemEx_6FC31490_113c(m, game, pDrop, 0) | 0
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [11/45] Rolls a spawnable armor classId of `nRequiredType` via `0x6FC2FA30`, finds a free drop
 * subtile near `pCoords` (`eax`) in `pRoom` (`ecx`), and creates the ground item with drop flag `0x40`.
 *
 * @va D2Game:0x6FC31FB0
 */
export function ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(
  m: D2KernMemory113c,
  pCoords: number,
  pRoom: number,
  pGame: number,
  nRequiredType: number,
  bSkipRarityRoll: number,
  pOwnerUnit: number,
): number {
  hitD2GameVa113c(0x6FC31FB0)
  const coords = pCoords >>> 0
  const room = pRoom >>> 0
  const game = pGame >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, room)
  let mlvl =
    DATATBLS_GetLevelMonsterLevel113c(
      m,
      nLevelId,
      m.u8((game + 0x6d) >>> 0),
      m.u32((game + 0x70) >>> 0),
    ) | 0
  if (mlvl > 1) {
    mlvl = (mlvl - 1) | 0
  }
  const pRoomSeed = room !== 0 ? (room + 0x6c) >>> 0 : 0
  const nClassId =
    ITEMS_RollSpawnableArmorId_6FC2FA30_113c(
      m,
      nRequiredType,
      game,
      pRoomSeed,
      mlvl,
      bSkipRarityRoll,
    ) | 0
  if (nClassId < 0) {
    return 0
  }

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0xa8) >>> 0
  try {
    m.fill(sp, 0xa8, 0)
    const pInCoords = sp
    const pOutCoords = (sp + 0x08) >>> 0
    const pDrop = (sp + 0x18) >>> 0
    m.setU32(pInCoords, m.u32(coords))
    m.setU32((pInCoords + 0x04) >>> 0, m.u32((coords + 0x04) >>> 0))

    const pTargetRoom =
      ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, room, pInCoords, pOutCoords, 1) >>> 0
    if (pTargetRoom === 0) {
      return 0
    }

    m.fill(pDrop, 0x84, 0)
    m.setU32((pDrop + 0x00) >>> 0, pOwnerUnit >>> 0)
    m.setU32((pDrop + 0x04) >>> 0, pRoomSeed)
    m.setU32((pDrop + 0x08) >>> 0, game)
    m.setU32((pDrop + 0x0c) >>> 0, mlvl >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 3)
    m.setU32((pDrop + 0x1c) >>> 0, m.u32(pOutCoords))
    m.setU32((pDrop + 0x20) >>> 0, m.u32((pOutCoords + 0x04) >>> 0))
    m.setU32((pDrop + 0x24) >>> 0, pTargetRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, m.u16((game + 0x78) >>> 0))
    m.setU32((pDrop + 0x30) >>> 0, 0)
    m.setU32((pDrop + 0x80) >>> 0, (m.u32((pDrop + 0x80) >>> 0) | 0x40) >>> 0)
    return D2GAME_CreateItemEx_6FC31490_113c(m, game, pDrop, 0) | 0
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [12/45] Spawns and drops a player ear (`'ear '`) on the ground in `pPlayerUnit`'s room (`edi = pPlayerUnit`,
 * `[esp+4] = pGame`).
 *
 * @va D2Game:0x6FC32AF0
 */
export function ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
  hooks?: K2W4B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC32AF0)
  const player = pPlayerUnit >>> 0
  const game = pGame >>> 0
  if (player === 0 || m.u32(player) !== 0) {
    return
  }

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0x18) >>> 0
  try {
    const pEarClassId = sp
    const pInCoords = (sp + 0x04) >>> 0
    const pOutCoords = (sp + 0x0c) >>> 0
    m.fill(sp, 0x18, 0)

    if (DATATBLS_GetItemsTxtRecordByCode113c(m, 0x20726165, pEarClassId) === 0) {
      return
    }

    PATH_GetTargetTypeAndPosition113c(m, player, pInCoords)
    const pRoom = UNITS_GetRoom113c(m, player) >>> 0
    const pTargetRoom =
      ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pRoom, pInCoords, pOutCoords, 1) >>> 0
    if (pTargetRoom === 0) {
      return
    }

    const nLevel = STATLIST_GetUnitStat113c(m, player, 0x0c, 0) | 0
    const nEarClassId = m.u32(pEarClassId)
    const pEarItem =
      ITEMS_SpawnItemWithParams_6FC31980_113c(
        m,
        nLevel,
        1,
        1,
        player,
        nEarClassId,
        game,
        4,
        2,
        0,
        0,
        0,
        hooks !== undefined ? hooks.laneI : undefined,
      ) >>> 0
    if (pEarItem !== 0) {
      const outX = m.u32(pOutCoords) | 0
      const outY = m.u32((pOutCoords + 0x04) >>> 0) | 0
      ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
        m,
        outY,
        pEarItem,
        pTargetRoom,
        game,
        0,
        outX,
        hooks !== undefined ? hooks.w3b1 : undefined,
      )
    }
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [13/45] Splits `dwGoldAmount` (`[ebp+0x10]`) into chunks of at most `2,000,000,000` (`0x77359400`),
 * creates `'gld '` items around `pUnit` (`[ebp+0xC]`), sets `STAT_GOLD` (`0x0E`), and places them
 * on the ground (`0x6FC2E990`).
 *
 * @va D2Game:0x6FC32B90
 */
export function ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  dwGoldAmount: number,
  hooks?: K2W4B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC32B90)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const totalGold = dwGoldAmount >>> 0

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0xb0) >>> 0
  try {
    const pGoldClassId = sp
    const pUnitCoords = (sp + 0x04) >>> 0
    const pOutCoords = (sp + 0x14) >>> 0
    const pDrop = (sp + 0x20) >>> 0
    m.fill(sp, 0xb0, 0)

    if (DATATBLS_GetItemsTxtRecordByCode113c(m, 0x20646c67, pGoldClassId) === 0) {
      return
    }

    let pRoom = UNITS_GetRoom113c(m, unit) >>> 0
    if (totalGold === 0) {
      return
    }

    let remGold = totalGold
    let droppedSoFar = 0
    while ((droppedSoFar >>> 0) < totalGold) {
      const chunk = remGold > 0x77359400 ? 0x77359400 : remGold
      remGold = (remGold - chunk) >>> 0
      droppedSoFar = (droppedSoFar + chunk) >>> 0

      PATH_GetTargetTypeAndPosition113c(m, unit, pUnitCoords)
      const nTryX = ((m.u32(pUnitCoords) | 0) + 2) | 0
      const nTryY = ((m.u32((pUnitCoords + 0x04) >>> 0) | 0) + 3) | 0
      if (ROOM_FindRoomContainingSubtile113c(m, pRoom, nTryX, nTryY) !== 0) {
        m.setU32(pOutCoords, nTryX >>> 0)
        m.setU32((pOutCoords + 0x04) >>> 0, nTryY >>> 0)
      } else {
        m.setU32(pOutCoords, m.u32(pUnitCoords) >>> 0)
        m.setU32((pOutCoords + 0x04) >>> 0, m.u32((pUnitCoords + 0x04) >>> 0) >>> 0)
      }
      const pTargetRoom =
        COLLISION_FindFreePositionBasic113c(
          m,
          pRoom,
          pOutCoords,
          pUnitCoords,
          1,
          0x3e01,
          0x801,
          1,
        ) >>> 0
      pRoom = pTargetRoom
      if (pTargetRoom !== 0) {
        const nGoldClassId = m.u32(pGoldClassId)
        m.fill(pDrop, 0x84, 0)
        m.setU32((pDrop + 0x00) >>> 0, unit)
        m.setU32((pDrop + 0x04) >>> 0, 0)
        m.setU32((pDrop + 0x08) >>> 0, game)
        m.setU32((pDrop + 0x0c) >>> 0, 1)
        m.setU32((pDrop + 0x14) >>> 0, nGoldClassId)
        m.setU32((pDrop + 0x18) >>> 0, 4)
        m.setU16((pDrop + 0x28) >>> 0, 1)
        m.setU16((pDrop + 0x2a) >>> 0, m.u16((game + 0x78) >>> 0))
        m.setU32((pDrop + 0x30) >>> 0, 2)
        m.setU32((pDrop + 0x80) >>> 0, (m.u32((pDrop + 0x80) >>> 0) | 0x0a) >>> 0)

        const pGoldItem = D2GAME_CreateItemEx_6FC31490_113c(m, game, pDrop, 0) >>> 0
        if (pGoldItem !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pGoldItem, 0x10, 1)
          const signedChunk = chunk | 0
          let statVal = signedChunk
          if (signedChunk < 0) {
            statVal = 0
          } else if (m.u32(pGoldItem) === 0) {
            const limit = STATLIST_GetUnitGoldBankLimit113c(m, pGoldItem) | 0
            if (signedChunk > limit) {
              statVal = 0
            }
          }
          STATLIST_SetUnitStat113c(m, pGoldItem, 0x0e, statVal, 0)
          const outX = m.u32(pOutCoords) | 0
          const outY = m.u32((pOutCoords + 0x04) >>> 0) | 0
          ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
            m,
            outY,
            pGoldItem,
            pTargetRoom,
            game,
            unit,
            outX,
            hooks !== undefined ? hooks.w3b1 : undefined,
          )
        }
      }
    }
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [14/45] Dispatches Set item generation for `pItem` (`eax`) by item format:
 * calls `0x6FC33C20` when `wItemFormat >= 1`, or `0x6FC33A30` when `wItemFormat == 0`.
 *
 * @va D2Game:0x6FC341E0
 */
export function ITEMS_ApplySetItemModsByFormat_6FC341E0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC341E0)
  const item = pItem >>> 0
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1) {
    return ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, item, pItemDrop >>> 0)
  }
  return ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(m, item)
}

/**
 * [15/45] Dispatches Low Quality item generation for `pItem` (`eax`) by item format:
 * calls `0x6FC33E60` when `wItemFormat >= 1`, or `0x6FC337F0` when `wItemFormat == 0`.
 *
 * @va D2Game:0x6FC34AF0
 */
export function ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC34AF0)
  const item = pItem >>> 0
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1) {
    return ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(m, item, pItemDrop >>> 0)
  }
  return ITEMS_ApplyLowQualityItemMods_6FC337F0_113c(m, item)
}

const RARE_AFFIX_COUNT_TABLE_113C: readonly number[] = [3, 4, 4, 5, 5, 5, 6, 6]

/**
 * [16/45] Dispatches rare name prefix/suffix roll for `pItem` (`esi`) and `bIsPrefix` (`edi`)
 * by item format (`0x6FC34210` for `wItemFormat >= 1`, `0x6FC34370` for `wItemFormat == 0`).
 *
 * @va D2Game:0x6FC34B30
 */
export function ITEMS_RollRareNameIdByFormat_6FC34B30_113c(
  m: D2KernMemory113c,
  pItem: number,
  bIsPrefix: number,
): number {
  hitD2GameVa113c(0x6FC34B30)
  const item = pItem >>> 0
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1) {
    return ITEMS_RollRarePrefixId_6FC34210_113c(m, bIsPrefix, item)
  }
  return ITEMS_RollRareSuffixId_6FC34370_113c(m, bIsPrefix, item)
}

/**
 * [17/45] Dispatches magic affix roll for `pItem` (`esi`) by item format (`0x6FC344D0` for
 * `wItemFormat >= 1`, `0x6FC348A0` for `wItemFormat == 0`).
 *
 * @va D2Game:0x6FC34B50
 */
export function ITEMS_RollMagicAffixByFormat_6FC34B50_113c(
  m: D2KernMemory113c,
  pItem: number,
  bIsPrefix: number,
  nForcedIndex: number,
  bAllowMagicOnly: number,
  bForceRoll: number,
  bApplyProps: number,
  dwRequiredGroup: number,
): number {
  hitD2GameVa113c(0x6FC34B50)
  const item = pItem >>> 0
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1) {
    return ITEMS_RollMagicAffixId_6FC344D0_113c(
      m,
      item,
      bAllowMagicOnly,
      bForceRoll,
      bApplyProps,
      bIsPrefix,
      nForcedIndex,
      dwRequiredGroup,
    )
  }
  return ITEMS_RollAutoMagicAffixId_6FC348A0_113c(
    m,
    item,
    bAllowMagicOnly,
    bForceRoll,
    bApplyProps,
    bIsPrefix,
    nForcedIndex,
  )
}

/**
 * [18/45] Rolls rare prefix/suffix names and 1..4 crafted magic affixes (up to 3 prefixes and
 * 3 suffixes, avoiding duplicate group IDs across up to 251 tries) for `pItem` (`esi`) from
 * `pItemDrop` (`[esp+4]`).
 *
 * @va D2Game:0x6FC34BF0
 */
export function ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC34BF0)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  const wRarePre =
    (ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1
      ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 1, item) & 0xffff
      : ITEMS_RollRareSuffixId_6FC34370_113c(m, 1, item) & 0xffff
  const wRareSuf =
    (ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1
      ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 0, item) & 0xffff
      : ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, item) & 0xffff

  if (wRarePre === 0 || wRareSuf === 0) {
    return 0
  }

  ITEMS_SetRarePrefix113c(m, item, wRarePre)
  ITEMS_SetRareSuffix113c(m, item, wRareSuf)

  const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
  const ilvl = m.u32((drop + 0x0c) >>> 0) | 0
  let minAffixes = 1
  if (ilvl > 0x1e) minAffixes = 2
  if (ilvl > 0x32) minAffixes = 3
  if (ilvl > 0x46) minAffixes = 4

  const newLo = stepSeed64At113c(m, pSeed)
  let numAffixes = ((newLo >>> 0) % 5) | 0
  if (minAffixes > numAffixes) {
    numAffixes = minAffixes
  }

  let prefixCount = 0
  let suffixCount = 0
  for (let iter = 0; iter < numAffixes; iter = (iter + 1) | 0) {
    const coin = stepSeed64At113c(m, pSeed) & 1
    const rollSuffix = prefixCount === 3 || (suffixCount !== 3 && coin !== 0)
    if (!rollSuffix) {
      let tries = 0
      let assigned = false
      while (tries <= 0xfa) {
        const forcedIdx = m.u32((drop + prefixCount * 4 + 0x68) >>> 0) | 0
        const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
        const cand =
          (wFormat >= 1
            ? ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 0, 1, forcedIdx, 0)
            : ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 1, 0, 1, forcedIdx)) & 0xffff
        let conflict = false
        for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
          const existing = ITEMS_GetMagicPrefix113c(m, item, slot) & 0xffff
          const pExistingTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, existing) >>> 0
          if (pExistingTxt !== 0) {
            const pCandTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, cand) >>> 0
            if (
              cand === existing ||
              (pCandTxt !== 0 &&
                m.u32((pCandTxt + 0x5c) >>> 0) === m.u32((pExistingTxt + 0x5c) >>> 0))
            ) {
              conflict = true
              break
            }
          }
        }
        if (!conflict) {
          ITEMS_SetMagicPrefix113c(m, item, cand, prefixCount)
          prefixCount = (prefixCount + 1) | 0
          assigned = true
          break
        }
        tries = (tries + 1) | 0
      }
      if (!assigned) {
        ITEMS_SetMagicPrefix113c(m, item, 0, prefixCount)
      }
    } else {
      let tries = 0
      let assigned = false
      while (tries <= 0xfa) {
        const forcedIdx = m.u32((drop + suffixCount * 4 + 0x74) >>> 0) | 0
        const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
        const cand =
          (wFormat >= 1
            ? ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 0, 0, forcedIdx, 0)
            : ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 1, 0, 0, forcedIdx)) & 0xffff
        let conflict = false
        for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
          const existing = ITEMS_GetMagicSuffix113c(m, item, slot) & 0xffff
          const pExistingTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, existing) >>> 0
          if (pExistingTxt !== 0) {
            const pCandTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, cand) >>> 0
            if (
              cand === existing ||
              (pCandTxt !== 0 &&
                m.u32((pCandTxt + 0x5c) >>> 0) === m.u32((pExistingTxt + 0x5c) >>> 0))
            ) {
              conflict = true
              break
            }
          }
        }
        if (!conflict) {
          ITEMS_SetMagicSuffix113c(m, item, cand, suffixCount)
          suffixCount = (suffixCount + 1) | 0
          assigned = true
          break
        }
        tries = (tries + 1) | 0
      }
      if (!assigned) {
        ITEMS_SetMagicSuffix113c(m, item, 0, suffixCount)
      }
    }
  }

  ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
  for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
    const wPre = ITEMS_GetMagicPrefix113c(m, item, slot) & 0xffff
    const pPreTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wPre) >>> 0
    if (pPreTxt !== 0) {
      ITEMS_ApplyItemQualityMods113c(m, 0, 0, item, pPreTxt, 0, 0)
    }
    const wSuf = ITEMS_GetMagicSuffix113c(m, item, slot) & 0xffff
    const pSufTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wSuf) >>> 0
    if (pSufTxt !== 0) {
      ITEMS_ApplyItemQualityMods113c(m, 0, 0, item, pSufTxt, 0, 0)
    }
  }
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, item, drop)
  return 1
}

/**
 * [19/45] Rolls rare prefix/suffix names and 3..4 (jewel `0x3A`) or 4..6 magic affixes for
 * `pItem` (`esi`) from `pItemDrop` (`[esp+4]`).
 *
 * @va D2Game:0x6FC34F20
 */
export function ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC34F20)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  const wRarePre =
    (ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1
      ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 1, item) & 0xffff
      : ITEMS_RollRareSuffixId_6FC34370_113c(m, 1, item) & 0xffff
  const wRareSuf =
    (ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1
      ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 0, item) & 0xffff
      : ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, item) & 0xffff

  if (wRarePre === 0 || wRareSuf === 0) {
    return 0
  }

  ITEMS_SetRarePrefix113c(m, item, wRarePre)
  ITEMS_SetRareSuffix113c(m, item, wRareSuf)

  const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
  const itemType = ITEMS_GetItemTypeFromItem113c(m, item) | 0
  const newLo = stepSeed64At113c(m, pSeed)
  const numAffixes =
    itemType === 0x3a ? ((newLo & 1) + 3) | 0 : (((newLo >>> 0) % 3) + 4) | 0
  if (numAffixes <= 0) {
    return 0
  }

  let prefixCount = 0
  let suffixCount = 0
  for (let iter = 0; iter < numAffixes; iter = (iter + 1) | 0) {
    const coin = stepSeed64At113c(m, pSeed) & 1
    const rollSuffix = prefixCount === 3 || (suffixCount !== 3 && coin !== 0)
    if (!rollSuffix) {
      let tries = 0
      let assigned = false
      while (tries <= 0xfa) {
        const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
        const cand =
          (wFormat >= 1
            ? ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 0, 1, 0, 0)
            : ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 1, 0, 1, 0)) & 0xffff
        if (cand === 0) {
          assigned = true
          break
        }
        let conflict = false
        for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
          const existing = ITEMS_GetMagicPrefix113c(m, item, slot) & 0xffff
          const pExistingTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, existing) >>> 0
          if (pExistingTxt !== 0) {
            const pCandTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, cand) >>> 0
            if (
              cand === existing ||
              (pCandTxt !== 0 &&
                m.u32((pCandTxt + 0x5c) >>> 0) === m.u32((pExistingTxt + 0x5c) >>> 0))
            ) {
              conflict = true
              break
            }
          }
        }
        if (!conflict) {
          ITEMS_SetMagicPrefix113c(m, item, cand, prefixCount)
          prefixCount = (prefixCount + 1) | 0
          assigned = true
          break
        }
        tries = (tries + 1) | 0
      }
      if (!assigned) {
        ITEMS_SetMagicPrefix113c(m, item, 0, prefixCount)
      }
    } else {
      let tries = 0
      let assigned = false
      while (tries <= 0xfa) {
        const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
        const cand =
          (wFormat >= 1
            ? ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 0, 0, 0, 0)
            : ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, item, 1, 1, 0, 0, 0)) & 0xffff
        if (cand === 0) {
          assigned = true
          break
        }
        let conflict = false
        for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
          const existing = ITEMS_GetMagicSuffix113c(m, item, slot) & 0xffff
          const pExistingTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, existing) >>> 0
          if (pExistingTxt !== 0) {
            const pCandTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, cand) >>> 0
            if (
              cand === existing ||
              (pCandTxt !== 0 &&
                m.u32((pCandTxt + 0x5c) >>> 0) === m.u32((pExistingTxt + 0x5c) >>> 0))
            ) {
              conflict = true
              break
            }
          }
        }
        if (!conflict) {
          ITEMS_SetMagicSuffix113c(m, item, cand, suffixCount)
          suffixCount = (suffixCount + 1) | 0
          assigned = true
          break
        }
        tries = (tries + 1) | 0
      }
      if (!assigned) {
        ITEMS_SetMagicSuffix113c(m, item, 0, suffixCount)
      }
    }
  }

  if (prefixCount === 0 && suffixCount === 0) {
    return 0
  }

  ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
  for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
    const wPre = ITEMS_GetMagicPrefix113c(m, item, slot) & 0xffff
    const pPreTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wPre) >>> 0
    if (pPreTxt !== 0) {
      ITEMS_ApplyItemQualityMods113c(m, 0, 0, item, pPreTxt, 0, 0)
    }
    const wSuf = ITEMS_GetMagicSuffix113c(m, item, slot) & 0xffff
    const pSufTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wSuf) >>> 0
    if (pSufTxt !== 0) {
      ITEMS_ApplyItemQualityMods113c(m, 0, 0, item, pSufTxt, 0, 0)
    }
  }
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, item, drop)
  return 1
}

/**
 * [20/45] Rolls rare prefix/suffix names and 3..6 rare magic affixes (`0x6FD1D058` table) for
 * `pItem` (`esi`) from `pItemDrop` (`[esp+4]`).
 *
 * @va D2Game:0x6FC35240
 */
export function ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC35240)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  const wRarePre =
    (ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1
      ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 1, item) & 0xffff
      : ITEMS_RollRareSuffixId_6FC34370_113c(m, 1, item) & 0xffff
  const wRareSuf =
    (ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1
      ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 0, item) & 0xffff
      : ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, item) & 0xffff

  if (wRarePre === 0 || wRareSuf === 0) {
    return 0
  }

  ITEMS_SetRarePrefix113c(m, item, wRarePre)
  ITEMS_SetRareSuffix113c(m, item, wRareSuf)

  const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
  const itemType = ITEMS_GetItemTypeFromItem113c(m, item) | 0
  const newLo = stepSeed64At113c(m, pSeed)
  let numAffixes: number
  if (itemType === 0x3a) {
    numAffixes = ((newLo & 1) + 3) | 0
  } else {
    const idx = newLo & 7
    const memVal = m.u32((0x6fd1d058 + idx * 4) >>> 0) | 0
    numAffixes = memVal !== 0 ? memVal : RARE_AFFIX_COUNT_TABLE_113C[idx]!
  }
  if (numAffixes <= 0) {
    return 0
  }

  let prefixCount = 0
  let suffixCount = 0
  let prefixDone = 0
  let suffixDone = 0
  let pForcedPre = (drop + 0x68) >>> 0
  let pForcedSuf = (drop + 0x74) >>> 0

  for (let i = 0; i < numAffixes; i = (i + 1) | 0) {
    let doSuffix = false
    if (prefixDone !== 0) {
      if (suffixDone !== 0) {
        break
      }
      doSuffix = true
    } else if (suffixDone === 0) {
      const coin = stepSeed64At113c(m, pSeed) & 1
      if (coin !== 0) {
        doSuffix = true
      }
    }

    if (doSuffix) {
      if (suffixCount >= 3) {
        throw new D2CommonAssertError('Items.cpp', 0x32e)
      }
      const forcedSuf = m.u32(pForcedSuf) | 0
      const cand = ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 0, 0, forcedSuf, 0) & 0xffff
      if (cand <= 0) {
        suffixDone = 1
        i = (i - 1) | 0
      } else {
        ITEMS_SetMagicSuffix113c(m, item, cand, suffixCount)
        suffixCount = (suffixCount + 1) | 0
        pForcedSuf = (pForcedSuf + 4) >>> 0
        if (suffixCount >= 3) {
          suffixDone = 1
        }
      }
    } else {
      if (prefixCount >= 3) {
        throw new D2CommonAssertError('Items.cpp', 0x31d)
      }
      const forcedPre = m.u32(pForcedPre) | 0
      const cand = ITEMS_RollMagicAffixId_6FC344D0_113c(m, item, 1, 1, 0, 1, forcedPre, 0) & 0xffff
      if (cand <= 0) {
        prefixDone = 1
        i = (i - 1) | 0
      } else {
        ITEMS_SetMagicPrefix113c(m, item, cand, prefixCount)
        prefixCount = (prefixCount + 1) | 0
        pForcedPre = (pForcedPre + 4) >>> 0
        if (prefixCount >= 3) {
          prefixDone = 1
        }
      }
    }
  }

  if (prefixCount === 0 && suffixCount === 0) {
    return 0
  }

  ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 0)
  for (let slot = 0; slot < 3; slot = (slot + 1) | 0) {
    const wPre = ITEMS_GetMagicPrefix113c(m, item, slot) & 0xffff
    const pPreTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wPre) >>> 0
    if (pPreTxt !== 0) {
      ITEMS_ApplyItemQualityMods113c(m, 0, 0, item, pPreTxt, 0, 0)
    }
    const wSuf = ITEMS_GetMagicSuffix113c(m, item, slot) & 0xffff
    const pSufTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wSuf) >>> 0
    if (pSufTxt !== 0) {
      ITEMS_ApplyItemQualityMods113c(m, 0, 0, item, pSufTxt, 0, 0)
    }
  }
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, item, drop)
  return 1
}

/**
 * [21/45] Executes pack-member or pack-leader idle patrol AI (`0x6FC373D0`).
 *
 * @va D2Game:0x6FC373D0
 */
export function AI_ThinkPackIdlePatrol_6FC373D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC373D0)
  const pAiControl = m.u32((pAiTickArgs + 0x00) >>> 0) >>> 0
  let pAiCmd = 0
  if (pUnit !== 0 && m.u32(pUnit >>> 0) === 1) {
    const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0) {
        pAiCmd = m.u32((pAiGeneral + 0x20) >>> 0) >>> 0
        if (pAiCmd !== 0 && m.u32((pAiCmd + 0x08) >>> 0) === 8) {
          AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame, pUnit)
          AI_InitMonsterAiThinkFn113c(m, pUnit, pGame, pAiControl, 0)
          invokeAiStall113c(m, pGame, pUnit, 0x0a)
          return
        }
      }
    }
  }

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0x28) >>> 0
  try {
    const pAnyDeadBox = sp
    const pCmdBuf = (sp + 0x04) >>> 0
    m.setU32(pAnyDeadBox, 0)
    AIGENERAL_ForEachPackMember_6FC41490_113c(
      m,
      pUnit,
      (mem: D2KernMemory113c, pMember: number, pCtx1: number) => {
        AI_CheckAnyMinionDeadCallback113c(mem, pMember, pCtx1)
      },
      pAnyDeadBox,
      0,
    )

    let bBreakPack = false
    if (pUnit !== 0 && m.u32(pUnit >>> 0) === 1) {
      const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonsterData !== 0) {
        const nAiState = m.u32((pMonsterData + 0x54) >>> 0) | 0
        if (nAiState === 3 || nAiState === 0x13) {
          bBreakPack = true
        }
      }
    }
    if (!bBreakPack && (m.u32(pAnyDeadBox) | 0) !== 0) {
      bBreakPack = true
    }
    if (bBreakPack) {
      m.fill(pCmdBuf, 0x1c, 0)
      m.setU32((pCmdBuf + 0x08) >>> 0, 8)
      AIGENERAL_BroadcastCmdToMinions113c(m, pUnit, pGame, pCmdBuf)
      AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame, pUnit)
      AI_InitMonsterAiThinkFn113c(m, pUnit, pGame, pAiControl, 0)
      invokeAiStall113c(m, pGame, pUnit, 0x0a)
      return
    }

    let pLeader = 0
    if (pUnit !== 0 && m.u32(pUnit >>> 0) === 1) {
      const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonsterData !== 0) {
        const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
        if (pAiGeneral !== 0 && m.u32((pAiGeneral + 0x28) >>> 0) !== 0) {
          pLeader = SUNIT_GetServerUnit113c(
            m,
            m.u32((pAiGeneral + 0x28) >>> 0),
            m.u32((pAiGeneral + 0x30) >>> 0),
            m.u32((pAiGeneral + 0x2c) >>> 0),
          ) >>> 0
        }
      }
    }

    if (pLeader !== (pUnit >>> 0)) {
      if (pAiCmd === 0) {
        invokeAiStall113c(m, pGame, pUnit, 0x0f)
        return
      }
      const targetX = ((m.u32((pAiCmd + 0x0c) >>> 0) | 0) + (m.u32((pAiControl + 0x14) >>> 0) | 0)) | 0
      const targetY = ((m.u32((pAiCmd + 0x10) >>> 0) | 0) + (m.u32((pAiControl + 0x18) >>> 0) | 0)) | 0
      AIGENERAL_PopAiCommand113c(m, pUnit)
      invokeAiApproachTarget113c(m, pGame, pUnit, 0, 2, targetX, targetY, 1, 0)
      return
    }

    if ((rollSeedPtrViaSeedRoll113c(m, (pUnit + 0x20) >>> 0, 100) | 0) < 30) {
      invokeAiStall113c(m, pGame, pUnit, 0x0a)
      return
    }

    let nStep = ((m.u32((pAiControl + 0x1c) >>> 0) | 0) + 1) | 0
    if (nStep >= 100) {
      nStep = 0
    }
    let x = UNIT_GetPosX113c(m, pUnit) | 0
    let y = UNIT_GetPosY113c(m, pUnit) | 0
    let delta = rollSeedPtrViaSeedRoll113c(m, (pUnit + 0x20) >>> 0, 10) | 0

    if (nStep < 25) {
      if (SEED_RollMaskFast113c(m, (pUnit + 0x20) >>> 0, 2) !== 0) {
        delta = (-delta) | 0
      }
      x = (x + delta) | 0
      y = (y - 5) | 0
    } else if (nStep < 50) {
      if (SEED_RollMaskFast113c(m, (pUnit + 0x20) >>> 0, 2) !== 0) {
        delta = (-delta) | 0
      }
      x = (x + 5) | 0
      y = (y + delta) | 0
    }
    if (nStep >= 50 && nStep < 75) {
      if (SEED_RollMaskFast113c(m, (pUnit + 0x20) >>> 0, 2) !== 0) {
        delta = (-delta) | 0
      }
      x = (x + delta) | 0
      y = (y + 5) | 0
    }
    if (nStep >= 75) {
      let dy = delta
      if (SEED_RollMaskFast113c(m, (pUnit + 0x20) >>> 0, 2) !== 0) {
        dy = (-dy) | 0
      }
      x = (x - 5) | 0
      y = (y + dy) | 0
    }

    if (invokeAiApproachTarget113c(m, pGame, pUnit, 0, 2, x, y, 1, 4) !== 0) {
      m.fill(pCmdBuf, 0x1c, 0)
      m.setU32((pCmdBuf + 0x08) >>> 0, 2)
      m.setU32((pCmdBuf + 0x0c) >>> 0, x >>> 0)
      m.setU32((pCmdBuf + 0x10) >>> 0, y >>> 0)
      AIGENERAL_BroadcastCmdToMinions113c(m, pUnit, pGame, pCmdBuf)
      m.setU32((pAiControl + 0x1c) >>> 0, nStep >>> 0)
      return
    }
    m.setU32((pAiControl + 0x1c) >>> 0, ((nStep + 25) | 0) >>> 0)
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [22/45] Executes Putrid Defiler target-acquisition and stall AI (`0x6FC389E0`).
 *
 * @va D2Game:0x6FC389E0
 */
export function AI_ThinkPutridDefiler_6FC389E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC389E0)
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiTickArgs + 0x08) >>> 0) >>> 0
  let bNeedScan = true
  if (pUnit !== 0) {
    const bHasTracked = (m.u32((pUnit + 0xc8) >>> 0) >>> 10) & 1
    if (bHasTracked !== 0) {
      const pTracked = SUNIT_GetServerUnit113c(
        m,
        pGame,
        m.u32((pUnit + 0x94) >>> 0),
        m.u32((pUnit + 0x98) >>> 0),
      ) >>> 0
      if (pTracked !== 0 && SUNIT_IsDeadOrDying113c(m, pTracked) === 0) {
        bNeedScan = false
      }
    }
  }

  if (bNeedScan && pTarget !== 0) {
    const pScanCtx = 0x00f0_b180
    m.fill(pScanCtx, 0x20, 0)
    m.setU32(pScanCtx + 0x00, 0x190)
    m.setU32(pScanCtx + 0x04, 0)
    let pFound = AITARGET_ScanUnitsByModeTable113c(m, 1, pScanCtx, pGame, pUnit, 0x6fc35b00) >>> 0
    if (pFound === 0) {
      const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
      if (pRoom !== 0) {
        for (let pCand = m.u32((pRoom + 0x74) >>> 0) >>> 0; pCand !== 0; pCand = m.u32((pCand + 0xe8) >>> 0) >>> 0) {
          const hit = AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, pGame, pUnit, pCand, pScanCtx) >>> 0
          if (hit !== 0) {
            pFound = hit
            break
          }
        }
      }
    }
    if (pFound !== 0) {
      AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, pFound, pUnit)
      const nDiff0 = m.u8((pGame + 0x6d) >>> 0)
      const nDelay0 = sx16(m.u16((pMonStatsTxt + nDiff0 * 2 + 0x56) >>> 0))
      invokeAiStall113c(m, pGame, pUnit, nDelay0)
    }
  }

  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const nDelay = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))
  invokeAiStall113c(m, pGame, pUnit, nDelay)
}

function applyMonUModElementalScaledDamage113c(
  m: D2KernMemory113c,
  pUnit: number,
  bChampion: number,
): { nLvl: number; nAddMin: number; nAddMax: number } | null {
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1) return null
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) return null
  const nDiffRaw = m.u8((pGame + 0x6d) >>> 0)
  const nDiff = nDiffRaw <= 0 ? 0 : nDiffRaw < 2 ? nDiffRaw : 2
  const bExp = m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0
  let nLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
  const pDataTables = readSgptDataTables113c(m)
  const nMonLvlCount = m.u32((pDataTables + 0xb74) >>> 0) | 0
  const nMaxIdx = (nMonLvlCount - 1) | 0
  if (nLvl <= 1) nLvl = 1
  if (nLvl >= nMaxIdx) nLvl = nMaxIdx
  if (nLvl < 0 || nLvl >= nMonLvlCount) return null
  const pMonLvlBase = m.u32((pDataTables + 0xb70) >>> 0) >>> 0
  const pMonLvlRec = (pMonLvlBase + imul32(nLvl, 0x78)) >>> 0
  if (pMonLvlRec === 0) return null
  const nCol = (nDiff + imul32(bExp + 6, 3)) | 0
  const nBaseDmg = m.u32((pMonLvlRec + (nCol << 2)) >>> 0) | 0
  const nMinMult = MONUMOD_GetConstantValue113c(m, (nDiff + (bChampion !== 0 ? 0x1c : 0x10)) | 0) | 0
  const nMaxMult = MONUMOD_GetConstantValue113c(m, (nDiff + (bChampion !== 0 ? 0x1f : 0x13)) | 0) | 0
  const nAddMin = sdiv32(imul32(nMinMult, nBaseDmg), 100)
  const nAddMax = sdiv32(imul32(nMaxMult, nBaseDmg), 100)
  return { nLvl, nAddMin, nAddMax }
}

/**
 * [23/45] Applies Poison Enchanted monster UMod (`0x6FC421D0`): adds poison min/max damage
 * (`stats 0x3E/0x3F`, shifted by 8) and delegates to `MONUMOD_ApplyResistanceBonus_6FC41BE0_113c`.
 *
 * @va D2Game:0x6FC421D0
 */
export function MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bChampion: number,
): void {
  hitD2GameVa113c(0x6FC421D0)
  const scaled = applyMonUModElementalScaledDamage113c(m, pUnit, bChampion)
  if (scaled === null) return
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x3e, (scaled.nAddMin << 8) | 0, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x3f, (scaled.nAddMax << 8) | 0, 0)
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pUnit, nUModId, bChampion)
}

/**
 * [24/45] Applies Cold Enchanted monster UMod (`0x6FC42320`): adds cold min/max/length
 * (`stats 0x39/0x3A/0x3B`) and delegates to `MONUMOD_ApplyResistanceBonus_6FC41BE0_113c`.
 *
 * @va D2Game:0x6FC42320
 */
export function MONUMOD_ApplyColdEnchantedStats_6FC42320_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bChampion: number,
): void {
  hitD2GameVa113c(0x6FC42320)
  const scaled = applyMonUModElementalScaledDamage113c(m, pUnit, bChampion)
  if (scaled === null) return
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x39, scaled.nAddMin, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x3a, scaled.nAddMax, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x3b, ((imul32(scaled.nLvl, 5) + 0x96) << 1) | 0, 0)
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pUnit, nUModId, bChampion)
}

/**
 * [25/45] Applies Fire Enchanted / Cold Length monster UMod (`0x6FC42490`): adds cold/fire min/max/length
 * (`stats 0x36/0x37/0x38`) and delegates to `MONUMOD_ApplyResistanceBonus_6FC41BE0_113c`.
 *
 * @va D2Game:0x6FC42490
 */
export function MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bChampion: number,
): void {
  hitD2GameVa113c(0x6FC42490)
  const scaled = applyMonUModElementalScaledDamage113c(m, pUnit, bChampion)
  if (scaled === null) return
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x36, scaled.nAddMin, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x37, scaled.nAddMax, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x38, (imul32(scaled.nLvl, 5) + 0x64) | 0, 0)
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pUnit, nUModId, bChampion)
}

/**
 * [26/45] Applies Lightning Enchanted monster UMod (`0x6FC42600`): adds lightning min/max damage
 * (`stats 0x32/0x33`) and delegates to `MONUMOD_ApplyResistanceBonus_6FC41BE0_113c`.
 *
 * @va D2Game:0x6FC42600
 */
export function MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bChampion: number,
): void {
  hitD2GameVa113c(0x6FC42600)
  const scaled = applyMonUModElementalScaledDamage113c(m, pUnit, bChampion)
  if (scaled === null) return
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x32, scaled.nAddMin, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x33, scaled.nAddMax, 0)
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pUnit, nUModId, bChampion)
}

/**
 * [27/45] Applies Fire Enchanted monster UMod (`0x6FC42740`): adds fire min/max damage
 * (`stats 0x30/0x31`) and delegates to `MONUMOD_ApplyResistanceBonus_6FC41BE0_113c`.
 *
 * @va D2Game:0x6FC42740
 */
export function MONUMOD_ApplyFireEnchantedStats_6FC42740_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bChampion: number,
): void {
  hitD2GameVa113c(0x6FC42740)
  const scaled = applyMonUModElementalScaledDamage113c(m, pUnit, bChampion)
  if (scaled === null) return
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x30, scaled.nAddMin, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x31, scaled.nAddMax, 0)
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pUnit, nUModId, bChampion)
}

const DEFAULT_RANDOM_ELEM_TYPES_6FD1CE00: readonly number[] = [0, 1, 2, 3, 5]

/**
 * [28/45] Rolls one of 5 elemental damage bonus entries (`0x6FD1CE00`) using `pUnit->tSeed` (`+0x20`)
 * when `bBoss != 0` and applies it via `MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c`.
 *
 * @va D2Game:0x6FC42B60
 */
export function MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(
  m: D2KernMemory113c,
  _nUModId: number,
  pUnit: number,
  _arg0: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC42B60)
  if (bBoss === 0) return
  const newLo = stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0
  const idx = (newLo % 5) | 0
  const entryAddr = (0x6fd1ce00 + idx * 12) >>> 0
  const memElem = m.u32(entryAddr) | 0
  const memFlag = m.u32((entryAddr + 4) >>> 0) | 0
  const nElemType = memElem !== 0 || memFlag !== 0 ? memElem : DEFAULT_RANDOM_ELEM_TYPES_6FD1CE00[idx]!
  MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c(m, pUnit, nElemType, bBoss)
}

/**
 * [29/45] Removes `pUnit` from its minion list (`0x6FC416A0`), resets `pAiGeneral` owner fields
 * (`+0x28 = pGame`, `+0x2C = -1`, `+0x30 = 1`), and if `dwAnimMode != 0`, clears the active skill
 * and transitions `pUnit` to mode `1` (`MONSTER_StartMode113c`).
 *
 * @va D2Game:0x6FC43730
 */
export function MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  _arg0 = 0,
): void {
  hitD2GameVa113c(0x6FC43730)
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame, pUnit)
  if (pUnit === 0) return
  if (m.u32(pUnit >>> 0) === 1) {
    const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    const pAiGeneral = pMonsterData !== 0 ? m.u32((pMonsterData + 0x28) >>> 0) >>> 0 : 0
    m.setU32((pAiGeneral + 0x2c) >>> 0, 0xffffffff)
    m.setU32((pAiGeneral + 0x30) >>> 0, 1)
    m.setU32((pAiGeneral + 0x28) >>> 0, pGame >>> 0)
  }
  if (m.u32((pUnit + 0x10) >>> 0) !== 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    invokeMonsterStartMode113c(m, pGame, pUnit, 1, 0, 0x64)
  }
}

/**
 * [30/45] Applies Champion Berserker UMod (`0x26`, `0x6FC437C0`): sets `pMonsterData->bTypeFlags |= 0x20`,
 * scales life by `+100%` (`MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c`), and applies champion base stats
 * (`MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c`).
 *
 * @va D2Game:0x6FC437C0
 */
export function MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC437C0)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1 || bBoss === 0) return
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonsterData !== 0) {
    m.setU8((pMonsterData + 0x16) >>> 0, (m.u8((pMonsterData + 0x16) >>> 0) | 0x20) & 0xff)
  }
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pUnit, 0x64)
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pUnit, nUModId, bBoss)
}

/**
 * [31/45] Applies Champion Fanatic UMod (`0x25`, `0x6FC43810`): sets `stat 0x10` (`item_armor_percent`)
 * to `-70` (`0xFFFFFFBA`) and delegates to `MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c`.
 *
 * @va D2Game:0x6FC43810
 */
export function MONUMOD_ApplyChampionFanaticStats_6FC43810_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC43810)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1 || bBoss === 0) return
  STATLIST_SetUnitStat113c(m, pUnit, 0x10, -70, 0)
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pUnit, nUModId, bBoss)
}

/**
 * [32/45] Applies Champion Ghostly UMod (`0x24`, `0x6FC43850`): sets `pMonsterData->bTypeFlags |= 0x40`,
 * sets `stat 0x24` (`damageresist`) to `80`, applies `MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c`,
 * and adds cold damage (`stats 0x36/0x37/0x38`) scaled from `MONLVL_GetRecordPtrFast_6FC21E90_113c` and
 * `MONUMOD_GetConstantValue113c`.
 *
 * @va D2Game:0x6FC43850
 */
export function MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC43850)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1) return
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0 || bBoss === 0) return

  const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonsterData !== 0) {
    m.setU8((pMonsterData + 0x16) >>> 0, (m.u8((pMonsterData + 0x16) >>> 0) | 0x40) & 0xff)
  }
  STATLIST_SetUnitStat113c(m, pUnit, 0x24, 0x50, 0)
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pUnit, nUModId, bBoss)

  const nDiffRaw = m.u8((pGame + 0x6d) >>> 0)
  const nDiff = nDiffRaw <= 0 ? 0 : nDiffRaw < 2 ? nDiffRaw : 2
  const bExp = m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0

  let nLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
  const pDataTables = readSgptDataTables113c(m)
  const nMaxIdx = ((m.u32((pDataTables + 0xb74) >>> 0) | 0) - 1) | 0
  if (nLvl <= 1) nLvl = 1
  if (nLvl >= nMaxIdx) nLvl = nMaxIdx

  const pMonLvlRec = MONLVL_GetRecordPtrFast_6FC21E90_113c(m, nLvl) >>> 0
  if (pMonLvlRec === 0) return

  const nCol = (nDiff + imul32(bExp + 6, 3)) | 0
  const nBaseDmg = m.u32((pMonLvlRec + (nCol << 2)) >>> 0) | 0
  const nMaxMult = MONUMOD_GetConstantValue113c(m, (nDiff + 0x19) | 0) | 0
  const nAddMax = sdiv32(imul32(nMaxMult, nBaseDmg), 100)
  const nMinMult = MONUMOD_GetConstantValue113c(m, (nDiff + 0x16) | 0) | 0
  const nAddMin = sdiv32(imul32(nMinMult, nBaseDmg), 100)

  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x36, nAddMin, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x37, nAddMax, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x38, 0x96, 0)
}

/**
 * [33/45] Rolls a weighted random boss UMod ID (`0x6FC43980`) from eligible `MonUMod.txt` rows
 * (`fChamp == 0`, `wUpick[nDiff] > 0`, `pExcludeFlags[id] == 0`).
 *
 * @va D2Game:0x6FC43980
 */
export function MONUMOD_RollRandomUniqueBossMod_6FC43980_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pExcludeFlags = 0,
): number {
  hitD2GameVa113c(0x6FC43980)
  if (pGame === 0) return 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  if (nDiff >= 3) return 0

  const pDataTables = readSgptDataTables113c(m)
  const nCount = m.u32((pDataTables + 0xc54) >>> 0) | 0
  const pBase = nCount > 0 ? m.u32((pDataTables + 0xc50) >>> 0) >>> 0 : 0

  const candIds = new Int32Array(0x100)
  const candWeights = new Int32Array(0x100)
  let nCandCount = 0
  let totalWeight = 0

  if (nCount > 0 && pBase !== 0) {
    const wPickOff = (nDiff * 2 + 0x14) >>> 0
    for (let id = 0; id < nCount; id = (id + 1) | 0) {
      const pRec = (pBase + (id << 5)) >>> 0
      const wWeight = sx16(m.u16((pRec + wPickOff) >>> 0))
      if (wWeight <= 0) continue
      if (m.u8((pRec + 0x08) >>> 0) !== 0) continue
      if (MONUMOD_CheckModEligibility_6FC43100_113c(m, pUnit, pGame, id, 1) === 0) continue
      if (pExcludeFlags !== 0 && m.u8((pExcludeFlags + id) >>> 0) !== 0) continue

      candIds[nCandCount] = id
      candWeights[nCandCount] = wWeight
      totalWeight = (totalWeight + wWeight) | 0
      nCandCount = (nCandCount + 1) | 0
      if (nCandCount >= 0x100) break
    }
  }

  let nRoll = 0
  if (totalWeight > 0) {
    const newLo = stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0
    const mask = (totalWeight - 1) >>> 0
    if (((totalWeight >>> 0) & mask) === 0) {
      nRoll = (newLo & mask) | 0
    } else {
      nRoll = (newLo % (totalWeight >>> 0)) | 0
    }
  }

  for (let i = 0; i < nCandCount; i = (i + 1) | 0) {
    const w = candWeights[i]!
    if (nRoll < w) {
      return candIds[i]!
    }
    nRoll = (nRoll - w) | 0
  }
  return 0
}

/**
 * [34/45] Rolls a weighted random champion UMod ID (`0x6FC43AE0`) from eligible `MonUMod.txt` rows
 * (`fChamp != 0`, `wCpick[nDiff] > 0`).
 *
 * @va D2Game:0x6FC43AE0
 */
export function MONUMOD_RollRandomChampionMod_6FC43AE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC43AE0)
  if (pGame === 0) return 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  if (nDiff >= 3) return 0

  const pDataTables = readSgptDataTables113c(m)
  const nCount = m.u32((pDataTables + 0xc54) >>> 0) | 0
  const pBase = nCount > 0 ? m.u32((pDataTables + 0xc50) >>> 0) >>> 0 : 0

  const candIds = new Int32Array(0x100)
  const candWeights = new Int32Array(0x100)
  let nCandCount = 0
  let totalWeight = 0

  if (nCount > 0 && pBase !== 0) {
    const wPickOff = (nDiff * 2 + 0x0e) >>> 0
    for (let id = 0; id < nCount; id = (id + 1) | 0) {
      const pRec = (pBase + (id << 5)) >>> 0
      const wWeight = sx16(m.u16((pRec + wPickOff) >>> 0))
      if (wWeight <= 0) continue
      if (m.u8((pRec + 0x08) >>> 0) === 0) continue
      if (MONUMOD_CheckModEligibility_6FC43100_113c(m, pUnit, pGame, id, 1) === 0) continue

      candIds[nCandCount] = id
      candWeights[nCandCount] = wWeight
      totalWeight = (totalWeight + wWeight) | 0
      nCandCount = (nCandCount + 1) | 0
      if (nCandCount >= 0x100) break
    }
  }

  let nRoll = rollSeedPtrViaSeedRoll113c(m, (pUnit + 0x20) >>> 0, totalWeight) | 0
  for (let i = 0; i < nCandCount; i = (i + 1) | 0) {
    const w = candWeights[i]!
    if (nRoll < w) {
      return candIds[i]!
    }
    nRoll = (nRoll - w) | 0
  }
  return 0
}

const DEFAULT_BASE_UMOD_IDS_6FD1CE7C: readonly number[] = [1, 2, 3, 4]

function dispatchMonUModTableEntry113c(
  m: D2KernMemory113c,
  pUnit: number,
  nUModId: number,
  bBoss: number,
): void {
  const pfn = m.u32((0x6fd2e550 + imul32(nUModId | 0, 4)) >>> 0) >>> 0
  if (pfn === 0) return
  switch (pfn) {
    case 0x6fc43020:
      MONUMOD_RollBossOrMinionNameSeed113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42fa0:
      MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc41e80:
      MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42bc0:
      MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42880:
      MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc41be0:
      MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42740:
      MONUMOD_ApplyFireEnchantedStats_6FC42740_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42da0:
      MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42600:
      MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42490:
      MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42320:
      MONUMOD_ApplyColdEnchantedStats_6FC42320_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc421d0:
      MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc441b0:
      MONSTER_AssignTeleportSkill_6FC441B0_113c(m as SparseMemory113c, pUnit, bBoss)
      return
    case 0x6fc44cd0:
      MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m as SparseMemory113c, pUnit, bBoss)
      return
    case 0x6fc43850:
      MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc43810:
      MONUMOD_ApplyChampionFanaticStats_6FC43810_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc437c0:
      MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc42d00:
      MONUMOD_ApplyGhostlyStats_6FC42D00_113c(m, pUnit, nUModId, bBoss)
      return
    case 0x6fc469f0:
      MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, pUnit, bBoss)
      return
    default:
      return
  }
}

/**
 * [35/45] Optionally spawns boss minion pack (`MONUMOD_SpawnBossMinionPack_6FC445A0_113c`),
 * applies base UMod callbacks (`0x6FD1CE7C..0x6FD1CE8C`) and `pBoss->pMonsterData->nMonUMod[0..8]`
 * to both `pBoss` (`bBoss = 1`) and all pack members (`AIGENERAL_ForEachPackMember_6FC41490_113c`, `bBoss = 0`).
 *
 * @va D2Game:0x6FC448A0
 */
export function MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(
  m: D2KernMemory113c,
  bSpawnMinions: number,
  pRoom: number,
  pGame: number,
  pBoss: number,
  pCoordNode = 0,
  nMinMinions?: number,
  nMaxMinions?: number,
): void {
  hitD2GameVa113c(0x6FC448A0)
  if (bSpawnMinions !== 0) {
    MONUMOD_SpawnBossMinionPack_6FC445A0_113c(
      m,
      pGame,
      pRoom,
      pCoordNode,
      pBoss,
      undefined,
      nMinMinions,
      nMaxMinions,
    )
  }

  const minionHooks: K2ItemsTcW1Hooks113c = {
    onMonUMod: (mem, _pfn, pMember, modId, isBoss) => {
      dispatchMonUModTableEntry113c(mem, pMember, modId, isBoss)
    },
  }

  for (let i = 0; i < 4; i = (i + 1) | 0) {
    const inMemId = m.u32((0x6fd1ce7c + i * 4) >>> 0) | 0
    const nBaseModId = inMemId !== 0 ? inMemId : DEFAULT_BASE_UMOD_IDS_6FD1CE7C[i]!
    dispatchMonUModTableEntry113c(m, pBoss, nBaseModId, 1)
    AIGENERAL_ForEachPackMember_6FC41490_113c(
      m,
      pBoss,
      (mem: D2KernMemory113c, pMember: number, modId: number, isBoss: number) => {
        MONUMOD_ApplyToMinionCallback113c(mem, pMember, modId, isBoss, minionHooks)
      },
      nBaseModId,
      0,
    )
  }

  if (pBoss === 0 || m.u32(pBoss >>> 0) !== 1) return
  const pMonsterData = m.u32((pBoss + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return
  const pUMods = (pMonsterData + 0x1c) >>> 0
  if (pUMods === 0) return

  for (let i = 0; i < 9; i = (i + 1) | 0) {
    const nUModId = m.u8((pUMods + i) >>> 0)
    if (nUModId === 0) break
    dispatchMonUModTableEntry113c(m, pBoss, nUModId, 1)
    AIGENERAL_ForEachPackMember_6FC41490_113c(
      m,
      pBoss,
      (mem: D2KernMemory113c, pMember: number, modId: number, isBoss: number) => {
        MONUMOD_ApplyToMinionCallback113c(mem, pMember, modId, isBoss, minionHooks)
      },
      nUModId,
      0,
    )
  }
}

/**
 * [36/45] Wrapper for `MONUMOD_SpawnScarabChargedBolts_6FC46320_113c` (`0x6FC468C0`):
 * skips when `pAttacker == NULL` or `pMonster->dwAnimMode == 3`.
 *
 * @va D2Game:0x6FC468C0
 */
export function MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  _nUModId: number,
  pAttacker: number,
): void {
  hitD2GameVa113c(0x6FC468C0)
  if (pAttacker === 0) return
  if (pMonster !== 0 && m.u32((pMonster + 0x10) >>> 0) === 3) return
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(m, pGame, pMonster)
}

/**
 * [37/45] Ends Charge/Leap movement state (`0x6FC48170`): clears `pSkill->dwParam0C`, refreshes AI event,
 * queues `0xA5` state-skill packet (`0x6FC9A0F0`), restores unit path collision masks, and removes the
 * skill's `wAuraTargetState` (`+0x80`) statlist.
 *
 * @va D2Game:0x6FC48170
 */
export function SKILLS_EndChargeOrLeapMovement_6FC48170_113c(
  m: D2KernMemory113c,
  pSkill: number,
  nSkillId: number,
  pUnit: number,
  nPosX: number,
  nPosY: number,
): number {
  hitD2GameVa113c(0x6FC48170)
  SKILLS_SetParam0C113c(m, pSkill, 0)
  MONSTER_RefreshAiEvent113c(m, pUnit, 0)
  UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)

  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) {
    return 0
  }

  const isPlayer = m.u32(pUnit >>> 0) === 0
  const nUnitMask = isPlayer ? 0x80 : 0x100
  const nMoveTestMask = isPlayer ? 0x1c09 : 0x3c01

  if (nPosX !== 0 && nPosY !== 0) {
    const nPattern = PATH_GetUnitCollisionPattern113c(m, pUnit)
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    COLLISION_ResetMaskWithPattern113c(m, pRoom, nPosX, nPosY, nPattern, nUnitMask)
  }

  PATH_SetCollisionMask113c(m, pPath, nUnitMask)
  PATH_SetMoveTestCollisionMask113c(m, pPath, nMoveTestMask)

  const skillIdx = nSkillId | 0
  if (skillIdx >= 0) {
    const pDataTables = readSgptDataTables113c(m)
    const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
    if (skillIdx < nSkillsCount) {
      const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      const pSkillsTxt = (pSkillsBase + imul32(skillIdx, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) {
        const wState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
        if (wState >= 0 && wState < (m.u32((pDataTables + 0xc4) >>> 0) | 0)) {
          STATES_ToggleGfxStateFlag113c(m, pUnit, wState, 0)
          const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
            m,
            pUnit,
            sx16(m.u16((pSkillsTxt + 0x80) >>> 0)),
          ) >>> 0
          if (pStatList !== 0) {
            STATLIST_UnlinkSubList113c(m, pUnit, pStatList)
            STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
          }
        }
      }
    }
  }

  return 1
}

function strncasecmpAscii16InMem113c(m: D2KernMemory113c, pStrA: number, pStrB: number): number {
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    let ca = m.u8((pStrA + i) >>> 0)
    let cb = m.u8((pStrB + i) >>> 0)
    if (ca >= 0x41 && ca <= 0x5a) ca = (ca + 0x20) | 0
    if (cb >= 0x41 && cb <= 0x5a) cb = (cb + 0x20) | 0
    if (ca !== cb) return (ca - cb) | 0
    if (ca === 0) return 0
  }
  return 0
}

/**
 * [38/45] Checks whether `szGameName` (`[esp+4]`, `ret 4`) is unused across all active game slots
 * in `0x6FD30C08..0x6FD31C08` (`GAME_LookupAndLockGameByKey_6FC4AAE0_113c`).
 *
 * @va D2Game:0x6FC4ABD0
 */
export function GAME_IsGameNameAvailable_6FC4ABD0_113c(
  m: D2KernMemory113c,
  szGameName: number,
): number {
  hitD2GameVa113c(0x6FC4ABD0)
  for (let pSlot = 0x6fd30c08; pSlot < 0x6fd31c08; pSlot = (pSlot + 4) >>> 0) {
    const dwKey = m.u32(pSlot) >>> 0
    if (dwKey === 0 || dwKey === 0xffffffff) continue
    const pGame = GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, dwKey) >>> 0
    if (pGame === 0) continue

    const cmp = strncasecmpAscii16InMem113c(m, szGameName >>> 0, (pGame + 0x2a) >>> 0)
    const pLock = m.u32((pGame + 0x18) >>> 0) >>> 0
    if (cmp === 0) {
      if (pLock === 0) {
        throw new D2CommonAssertError('GAME_IsGameNameAvailable_6FC4ABD0_113c: null game lock', 0x100f)
      }
      return 0
    }
    if (pLock === 0) {
      throw new D2CommonAssertError('GAME_IsGameNameAvailable_6FC4ABD0_113c: null game lock', 0x100f)
    }
  }
  return 1
}

/**
 * [39/45] Operates a gold chest/stash object (`0x6FC4F580`), transitioning `pObject` to mode `2`
 * and spawning `1..9` gold piles at free subtile offsets (`ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c`).
 *
 * @va D2Game:0x6FC4F580
 */
export function OBJECTS_OperateGoldChestOrPile_6FC4F580_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): void {
  hitD2GameVa113c(0x6FC4F580)
  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return
  }

  UNITS_ChangeAnimMode113c(m, pObject, 2)
  const baseY = m.u32((pOperateArgs + 0x18) >>> 0) | 0
  let checkBaseX = m.u32((pOperateArgs + 0x14) >>> 0) | 0
  let pSeed = m.u32((pOperateArgs + 0x0c) >>> 0) >>> 0
  const roll0 = stepSeed64At113c(m, pSeed) >>> 0
  const nPiles = ((roll0 % 9) + 1) | 0

  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0x08) >>> 0
  try {
    const pCoords = sp
    for (let rem = nPiles; rem > 0; rem = (rem - 1) | 0) {
      pSeed = m.u32((pOperateArgs + 0x0c) >>> 0) >>> 0
      const dx = stepSeed64At113c(m, pSeed) & 3
      pSeed = m.u32((pOperateArgs + 0x0c) >>> 0) >>> 0
      const dy = stepSeed64At113c(m, pSeed) & 3

      const pRoom = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
      const checkX = (checkBaseX + dx) | 0
      const pFoundRoom = ROOM_FindRoomContainingSubtile113c(
        m,
        pRoom,
        checkX,
        (baseY + dy) | 0,
      ) >>> 0
      if (pFoundRoom === pRoom) {
        checkBaseX = ((m.u32((pOperateArgs + 0x14) >>> 0) | 0) + dx) | 0
        const targetY = ((m.u32((pOperateArgs + 0x18) >>> 0) | 0) + dy) | 0
        if ((COLLISION_CheckMaskWithSizeXY113c(m, pFoundRoom, checkBaseX, targetY, 1, 1, 0x3f11) & 0xffff) === 0) {
          m.setU32(pCoords + 0x00, checkBaseX >>> 0)
          m.setU32(pCoords + 0x04, targetY >>> 0)
          ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c(
            m,
            pCoords,
            m.u32((pOperateArgs + 0x00) >>> 0) >>> 0,
            m.u32((pOperateArgs + 0x08) >>> 0) >>> 0,
          )
        }
      }
    }
  } finally {
    k2W4B1StackPtr = sp
  }
}

/**
 * [40/45] Wrapper that invokes `OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c` with `nAxis = 1`
 * and returns `1`.
 *
 * @va D2Game:0x6FC52790
 */
export function OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  pRoomCoords = 0x00f0_b1c0,
  nFixedCoord = 0,
): number {
  hitD2GameVa113c(0x6FC52790)
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
  OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c(
    m,
    pGame,
    pRoom,
    pRoomCoords,
    1,
    nFixedCoord,
    nDensity,
  )
  return 1
}

/**
 * [41/45] Wrapper that invokes `OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c` with `nAxis = 0`
 * and returns `1`.
 *
 * @va D2Game:0x6FC527B0
 */
export function OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  pRoomCoords = 0x00f0_b1c0,
  nFixedCoord = 0,
): number {
  hitD2GameVa113c(0x6FC527B0)
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
  OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c(
    m,
    pGame,
    pRoom,
    pRoomCoords,
    0,
    nFixedCoord,
    nDensity,
  )
  return 1
}

/**
 * [42/45] Spawns a shrine object from an object-group entry (`0x6FC527D0`), enforcing
 * act/level shrine spacing (`OBJRGN_CheckCoordSpacing40_6FC2B670_113c`) and forced health/mana
 * shrine substitution when act ratio exceeds `0x60`.
 *
 * @va D2Game:0x6FC527D0
 */
export function OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nObjectId: number,
  _nWallSide: number,
  wDensity: number,
): number {
  hitD2GameVa113c(0x6FC527D0)
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
  const nSizeX = m.u32((pObjTxt + 0xd0) >>> 0) | 0
  const nSizeY = m.u32((pObjTxt + 0xd4) >>> 0) | 0
  const sp = k2W4B1StackPtr
  k2W4B1StackPtr = (sp + 0x20) >>> 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
  } finally {
    k2W4B1StackPtr = sp
  }
  const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0

  const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  const roll = (stepSeed64At113c(m, pRoomSeed) >>> 0) % 100

  const pObjRegion = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const pActCtrl = m.u32((pObjRegion + nLevelId * 4 + 0x48) >>> 0) >>> 0
  let bForceShrine = 0
  let nMaxTries = 3
  const nTotalRooms = m.u32((pActCtrl + 0x08) >>> 0) | 0
  if (nTotalRooms > 0) {
    const ratio = Math.trunc(((m.u32((pActCtrl + 0x04) >>> 0) | 0) << 7) / nTotalRooms) | 0
    if (ratio > 0x60 && (m.u32((pActCtrl + 0x10) >>> 0) | 0) === 0) {
      bForceShrine = 1
      nMaxTries = 0x1e
    }
  }

  if (bForceShrine === 0 && (roll >>> 0) > (wDensity & 0xffff)) {
    return 0
  }

  const nShrineCount = m.u32((pActCtrl + 0x14) >>> 0) | 0
  const nCap = ((nTotalRooms + ((nTotalRooms >> 31) & 7)) >> 3) | 0
  if (nShrineCount === 10 || nShrineCount > nCap || nMaxTries <= 0) {
    return 0
  }

  let pUnit = 0
  for (let rem = nMaxTries; rem > 0; rem = (rem - 1) | 0) {
    pUnit = OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c(
      m,
      pGame,
      nObjectId,
      nSizeX,
      nSizeY,
      pRoom,
      m.u8((pObjTxt + 0x13c) >>> 0),
      nLevelId,
      0x6fc2b670,
      {
        onObjectPosValidate: (mem, _objId, ctxLevel, x, y) =>
          OBJRGN_CheckCoordSpacing40_6FC2B670_113c(mem, pGame, ctxLevel, x, y),
      },
    ) >>> 0
    if (pUnit !== 0) break
  }
  if (pUnit === 0) {
    return 0
  }

  const nMode = m.u32((pUnit + 0x10) >>> 0) >>> 0
  const bModeFlag = m.u8((pObjTxt + nMode + 0xc4) >>> 0)
  const dwFlagsC4 = m.u32((pUnit + 0xc4) >>> 0) >>> 0
  m.setU32((pUnit + 0xc4) >>> 0, bModeFlag !== 0 ? (dwFlagsC4 | 2) >>> 0 : (dwFlagsC4 & ~2) >>> 0)

  const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (m.u8((pObjData + 0x04) >>> 0) === 2) {
    m.setU32((pActCtrl + 0x10) >>> 0, ((m.u32((pActCtrl + 0x10) >>> 0) | 0) + 1) >>> 0)
  } else if (bForceShrine !== 0) {
    OBJECTS_SubstituteObjectClassIdFromParm0_113c(m, pUnit)
    OBJECTS_PickShrineIdFromControlGroup113c(m, 2, pGame, 1)
    m.setU8((pObjData + 0x04) >>> 0, 2)
    const pShrineTxt = DATATBLS_GetObjGroupTxtRecord113c(m, 2) >>> 0
    UNITS_SetObjectShrineTxt113c(m, pUnit, pShrineTxt)
    m.setU32((pActCtrl + 0x10) >>> 0, ((m.u32((pActCtrl + 0x10) >>> 0) | 0) + 1) >>> 0)
  }

  const posY = UNIT_GetPosY113c(m, pUnit) | 0
  const posX = UNIT_GetPosX113c(m, pUnit) | 0
  const idx = m.u32((pActCtrl + 0x14) >>> 0) | 0
  if (idx < 10) {
    m.setU32((pActCtrl + idx * 8 + 0x40) >>> 0, posX >>> 0)
    m.setU32((pActCtrl + idx * 8 + 0x44) >>> 0, posY >>> 0)
    m.setU32((pActCtrl + 0x14) >>> 0, ((idx + 1) | 0) >>> 0)
  }
  return pUnit
}

/**
 * [43/45] Spawns a well object from an object-group entry (`0x6FC52A10`), enforcing
 * act/level well spacing (`OBJRGN_CheckCoordSpacing20_6FC2B700_113c`) and recording up to 4 wells.
 *
 * @va D2Game:0x6FC52A10
 */
export function OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nGroupProbByte: number,
  nObjectId: number,
  wDensity: number,
): number {
  hitD2GameVa113c(0x6FC52A10)
  const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
  const pObjRegion = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const pActCtrl = m.u32((pObjRegion + nLevelId * 4 + 0x48) >>> 0) >>> 0
  const nWellCount = m.u32((pActCtrl + 0x18) >>> 0) | 0
  const nTotalRooms = m.u32((pActCtrl + 0x08) >>> 0) | 0
  const nCap = ((nTotalRooms + ((nTotalRooms >> 31) & 7)) >> 3) | 0
  if (nWellCount === 4 || nWellCount > nCap) {
    return 0
  }
  if ((nGroupProbByte & 0xff) > 0x80) {
    throw new D2CommonAssertError('OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c: prob > 0x80', 0x8d0)
  }

  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
  const nSizeX = m.u32((pObjTxt + 0xd0) >>> 0) | 0
  const nSizeY = m.u32((pObjTxt + 0xd4) >>> 0) | 0
  const pRoomRect = 0x00f0_b1d0
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomRect)

  const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  const roll = (stepSeed64At113c(m, pRoomSeed) >>> 0) % 100
  if ((roll >>> 0) > (wDensity & 0xffff)) {
    return 0
  }

  const pUnit = OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c(
    m,
    pGame,
    nObjectId,
    (nSizeX * 2 + 1) | 0,
    (nSizeY * 2 + 1) | 0,
    pRoom,
    nLevelId,
    0x6fc2b700,
    {
      onObjectPosValidate: (mem, _objId, ctxLevel, x, y) =>
        OBJRGN_CheckCoordSpacing20_6FC2B700_113c(mem, pGame, ctxLevel, x, y),
    },
  ) >>> 0
  if (pUnit !== 0) {
    const nMode = m.u32((pUnit + 0x10) >>> 0) >>> 0
    const bModeFlag = m.u8((pObjTxt + nMode + 0xc4) >>> 0)
    const dwFlagsC4 = m.u32((pUnit + 0xc4) >>> 0) >>> 0
    m.setU32((pUnit + 0xc4) >>> 0, bModeFlag !== 0 ? (dwFlagsC4 | 2) >>> 0 : (dwFlagsC4 & ~2) >>> 0)

    const posY = UNIT_GetPosY113c(m, pUnit) | 0
    const posX = UNIT_GetPosX113c(m, pUnit) | 0
    const idx = m.u32((pActCtrl + 0x18) >>> 0) | 0
    if (idx < 4) {
      m.setU32((pActCtrl + idx * 8 + 0x20) >>> 0, posX >>> 0)
      m.setU32((pActCtrl + idx * 8 + 0x24) >>> 0, posY >>> 0)
      m.setU32((pActCtrl + 0x18) >>> 0, ((idx + 1) | 0) >>> 0)
    }
  }
  return pUnit
}

const CHEST_CLUSTER_DEFAULT_OFFSETS_113C: readonly (readonly [number, number])[] = [
  [0, 0],
  [2, 0],
  [0, 2],
]

/**
 * [44/45] Spawns a cluster of chests (`0x39..0x3A`) in `pRoom` (`0x6FC52DF0`), checking margin-7
 * clearance (`OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c`) and target-spot object `0x67`
 * (`OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c`).
 *
 * @va D2Game:0x6FC52DF0
 */
export function OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nObjectId: number,
  wDensity: number,
): number {
  hitD2GameVa113c(0x6FC52DF0)
  const pObjRegion = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const roll = (stepSeed64At113c(m, pObjRegion) >>> 0) % 100
  if ((roll >>> 0) > (wDensity & 0xffff)) {
    return 0
  }

  let nPatternCount = m.u32(0x6fd2e2f8) | 0
  if (nPatternCount <= 0) nPatternCount = 3
  const patternIdx = SEED_RollLimitedFast113c(m, pObjRegion, nPatternCount) | 0

  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
  const nSizeX = m.u32((pObjTxt + 0xd0) >>> 0) | 0
  const nSizeY = m.u32((pObjTxt + 0xd4) >>> 0) | 0
  const pRoomRect = 0x00f0_b1d0
  const pPos = 0x00f0_b1f0
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomRect)

  const subX = m.u32((pRoomRect + 0x00) >>> 0) | 0
  const subY = m.u32((pRoomRect + 0x04) >>> 0) | 0
  const subW = m.u32((pRoomRect + 0x08) >>> 0) | 0
  const subH = m.u32((pRoomRect + 0x0c) >>> 0) | 0

  let baseX = 0
  let baseY = 0
  let foundSpot = false
  for (let tries = 8; tries > 0; tries = (tries - 1) | 0) {
    const rangeX = (subW - nSizeX - 1) | 0
    const offX = rangeX > 0 ? SEED_RollLimitedFast113c(m, pObjRegion, rangeX) | 0 : 0
    baseX = (subX + offX) | 0

    const rangeY = (subH - nSizeY - 1) | 0
    const offY = rangeY > 0 ? SEED_RollLimitedFast113c(m, pObjRegion, rangeY) | 0 : 0
    baseY = (subY + offY) | 0

    m.setU32((pPos + 0x00) >>> 0, baseX >>> 0)
    m.setU32((pPos + 0x04) >>> 0, baseY >>> 0)
    if (OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomRect, pPos, 5, pRoom, 5) === 1) {
      foundSpot = true
      break
    }
  }
  if (!foundSpot) {
    return 0
  }

  const pPatternEntry = (0x6fd2e608 + patternIdx * 8) >>> 0
  const pOffsetTable = m.u32((pPatternEntry + 0x00) >>> 0) >>> 0
  let count = m.u32((pPatternEntry + 0x04) >>> 0) | 0
  if (pOffsetTable === 0 && count <= 0) {
    count = CHEST_CLUSTER_DEFAULT_OFFSETS_113C.length
  }

  let pLastUnit = 0
  for (let i = 0; i < count; i = (i + 1) | 0) {
    const dx =
      pOffsetTable !== 0
        ? m.u32((pOffsetTable + i * 8 + 0x00) >>> 0) | 0
        : CHEST_CLUSTER_DEFAULT_OFFSETS_113C[i % CHEST_CLUSTER_DEFAULT_OFFSETS_113C.length]![0]
    const dy =
      pOffsetTable !== 0
        ? m.u32((pOffsetTable + i * 8 + 0x04) >>> 0) | 0
        : CHEST_CLUSTER_DEFAULT_OFFSETS_113C[i % CHEST_CLUSTER_DEFAULT_OFFSETS_113C.length]![1]
    const spotX = (baseX + dx) | 0
    const spotY = (baseY + dy) | 0
    m.setU32((pPos + 0x00) >>> 0, spotX >>> 0)
    m.setU32((pPos + 0x04) >>> 0, spotY >>> 0)

    if (
      OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomRect, pPos, nSizeX, pRoom, nSizeY) !== 1
    ) {
      continue
    }

    const nChestClassId = ((stepSeed64At113c(m, pObjRegion) & 1) + 0x39) >>> 0
    if (nChestClassId > 0x3a) {
      throw new D2CommonAssertError('OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c: bad chest class', 0x7dd)
    }
    if (pRoom === 0) {
      throw new D2CommonAssertError('OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c: null room', 0x7de)
    }

    const pUnit = UNIT_Alloc113c(m, 2) >>> 0
    if (pUnit === 0) {
      pLastUnit = 0
      continue
    }

    m.setU32((pUnit + 0x00) >>> 0, 2)
    m.setU32((pUnit + 0x04) >>> 0, nChestClassId)
    m.setU32((pUnit + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
    m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)

    let dwFlagsC8 = m.u32((pUnit + 0xc8) >>> 0) >>> 0
    dwFlagsC8 = m.u32((pGame + 0x70) >>> 0) !== 0 ? (dwFlagsC8 | 0x0200_0000) >>> 0 : (dwFlagsC8 & ~0x0200_0000) >>> 0
    m.setU32((pUnit + 0xc8) >>> 0, (dwFlagsC8 | 0x0400_0000) >>> 0)

    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    m.setU8((pUnit + 0x18) >>> 0, nAct)
    m.setU32((pUnit + 0x74) >>> 0, 0)
    m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + nAct * 4 + 0xbc) >>> 0))
    SUNIT_InitUnitSeed113c(m, pUnit, (pGame + 0xd0) >>> 0)
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x10) >>> 0)
    m.setU32((pUnit + 0xd0) >>> 0, 0x0b)

    let nNextGuid = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0
    if (nNextGuid === 0xffffffff) nNextGuid = 1
    m.setU32((pGame + 0x98) >>> 0, nNextGuid)

    let pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pObjData === 0) {
      pObjData = m.alloc(0x38) >>> 0
      m.setU32((pUnit + 0x14) >>> 0, pObjData)
    }
    m.fill(pObjData, 0x38, 0)
    m.setU32((pObjData + 0x00) >>> 0, DATATBLS_GetObjectsTxtRecord113c(m, nChestClassId) >>> 0)
    m.setU32((pUnit + 0x10) >>> 0, 0)
    UNITS_AllocStaticPath113c(m, pUnit)

    const placeX = m.u32((pPos + 0x00) >>> 0) | 0
    const placeY = m.u32((pPos + 0x04) >>> 0) | 0
    OBJECTS_InitObjectUnit113c(m, pUnit, pGame, nNextGuid, pRoom, placeX, placeY)
    SUNIT_PlaceServerUnitInRoom113c(m, pRoom, placeY, pUnit, placeX, pGame, 1)
    pLastUnit = pUnit
    OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c(m, pUnit, pGame)
  }

  return pLastUnit >>> 0
}

/**
 * [45/45] Spawns preset object `244` (`0x6FC531B0`, substituting `0x173` in level `0x19` via
 * `OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c`), updates interactable/portal flags, sets
 * `+0xc4 |= 0x80`, and transitions to anim mode `0`.
 *
 * @va D2Game:0x6FC531B0
 */
export function OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nObjectId: number,
  x: number,
  y: number,
  nInitMode = 0,
): number {
  hitD2GameVa113c(0x6FC531B0)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nEffObjectId = nLevelId === 0x19 ? 0x173 : nObjectId
  const pUnit = OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c(
    m,
    pGame,
    pRoom,
    nEffObjectId,
    x,
    y,
    nInitMode,
  ) >>> 0
  if (pUnit === 0) {
    return 0
  }

  let bSetInteract = true
  if (nLevelId >= 0x3e && nLevelId <= 0x40) {
    const pObjRegion = m.u32((pGame + 0x10f0) >>> 0) >>> 0
    const roll = (stepSeed64At113c(m, pObjRegion) >>> 0) % 100
    if (roll > 0x32) {
      bSetInteract = false
    }
  }

  if (bSetInteract) {
    m.setU8((pUnit + 0x78) >>> 0, 1)
    if (nLevelId === 0x19) {
      const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pObjData !== 0) {
        m.setU8((pObjData + 0x04) >>> 0, 3)
      }
    }
  }

  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x80) >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit, 0)
  return pUnit
}
