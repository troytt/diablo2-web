/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 4 Batch 3 (`w4b3`) routines across
 * `0x6FC22630..0x6FC90D90` (45 functions).
 */

import { COLLISION_FindFreePositionBasic113c } from '../common/collision'
import {
  UNITS_GetField7C_113c,
  UNITS_GetPlayerData113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { SEED_GetLowSeed113c } from '../common/drlg/drlg-grid'
import { DRLGPRESET_MovePointerAndClear113c } from '../common/drlg/preset'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_IsTownLevelId113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, sdiv32 } from '../common/int-math'
import {
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetEquippedWeaponHandClass113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetActiveWeaponForAttack113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_IsRareQualityAllowed113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOwnerGuid113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports'
import {
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_SetTargetX113c,
} from '../common/missile'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
} from '../common/path'
import {
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  STATES_UpdateOrClearState98Transform113c,
} from '../common/skills'
import {
  ITEMS_SetItemCell113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetRoom113c,
  UNITS_IsUnitInObjRectRange113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint'
import type { Memory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c, seedRoll } from '../prng'
import { DATATBLS_GetLevelMonsterLevel113c } from '../tables/datatbls-113c'
import { DATATBLS_GetItemIdFromItemCode113c } from '../tables/item-tbls-113c'
import { MONSTER_InitModeChangeStrc113c } from './ai-fallen-113c'
import { PLAYER_StartModeOnUnit113c } from './c2s-packet-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_SrvDo01_LinearProjectile113c,
} from './k2-gap-melee-dot-113c'
import {
  AIGENERAL_GetQuestDataPtr38_113c,
  ITEMS_FindSuperiorQualityRecordIndex113c,
  MONUMOD_AppendUModToMonster113c,
  MONUMOD_CountUnitUMods113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  QUESTS_GuidListAdd113c,
} from './k2-items-tc-w1-113c'
import { STATLIST_SetUnitStatGoldGuarded_6FC21040_113c } from './k2-laneH-0x6fc2-w1-113c'
import {
  AIGENERAL_ForEachPackMember_6FC41490_113c,
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  type LaneIHooks113c,
} from './k2-laneI-0x6fc3-w1-113c'
import { QUESTS_CheckNotIntro_6FC53970_113c } from './k2-laneJ-0x6fc4-w1-113c'
import {
  type LaneK0x6fc5Hooks113c,
  QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c,
} from './k2-laneK-0x6fc5-w1-113c'
import {
  ACT1_IntroStatusFilter_6FC80800_113c,
  ACT4_EndgameStatusFilter_6FC80810_113c,
  ACT4_IntroCallback08Noop_6FC80180_113c,
  ACT4_IntroStatusFilter_6FC80170_113c,
  ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c,
  type K2W2B1Hooks113c,
  STORM_TSListPlacementNewCopy_6FC226F0_113c,
} from './k2-w2b1-113c'
import { ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c } from './k2-w2b2-113c'
import { NET_SendPacket77_ButtonAction_6FCAB340_113c } from './k2-w2b3-113c'
import { ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c } from './k2-w2b6-113c'
import { SUNIT_SetLastKillerInfo_6FCFFAE0_113c } from './k2-w2b8-113c'
import {
  ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c,
  OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c,
} from './k2-w3b1-113c'
import {
  type K2W3B3Hooks113c,
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c,
} from './k2-w3b3-113c'
import {
  ACT5Q4_SeqFilter_6FC76B10_113c,
  type K2W3B5Hooks113c,
} from './k2-w3b5-113c'
import {
  ACT1_IntroCainActivate_6FC824D0_113c,
  ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c,
  ACT1_IntroNpcActivate_6FC82E50_113c,
  ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c,
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c,
} from './k2-w3b6-113c'
import {
  CUBE_ValidateRecipeInputSlot_6FC90240_113c,
  NET_SendEventMessagePacket5A_6FC90BF0_113c,
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c,
  OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c,
  OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c,
  SKILLS_CalcUnitSkillToHit_6FC89B00_113c,
} from './k2-w3b7-113c'
import {
  GAME_IsGameNameAvailable_6FC4ABD0_113c,
  ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c,
  ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c,
  ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c,
  ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c,
  ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c,
  ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c,
  ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c,
  ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c,
  ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c,
  MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c,
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c,
  MONUMOD_RollRandomChampionMod_6FC43AE0_113c,
  MONUMOD_RollRandomUniqueBossMod_6FC43980_113c,
  MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c,
  STORM_TSListDestroySehWrapper_6FC21F60_113c,
} from './k2-w4b1-113c'
import {
  ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c,
  ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c,
  MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c,
  QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c,
  SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c,
} from './k2-w4b2-113c'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
  ITEMS_RollAndApplySockets_6FC2EC90_113c,
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c,
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c,
  isAffixTablesLoaded113c,
  isSgptDataTablesLoaded113c,
} from './k2-real-itemdrop-113c'
import { MONSTER_StartMode113c as MONSTER_StartModeReal113c } from './k2-real-s2c-combat-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTER_Create113c,
  MONSTER_SpawnAtCoords113c,
  type RegpopSpawnHooks113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
} from './regpop-spawn-113c'
import { type FallenSliceWorld113c, MONSTER_StartMode113c } from './replay-kernel-113c'
import { EVENT_SetEventFull113c, type EventWheelHooks113c } from './timer-wheel'
import {
  ACT1Q0_CheckWarrivIntroNpcAlert113c,
  ACT1Q2_CheckAkaraIntroNpcAlert113c,
  ACT1Q6_CheckTravelEastNpcAlert113c,
} from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

export interface K2W4B3Hooks113c {
  readonly eventWheel?: EventWheelHooks113c
  readonly laneI?: LaneIHooks113c
  readonly laneK?: LaneK0x6fc5Hooks113c
  readonly meleeDot?: K2GapMeleeDotHooks113c
  readonly regpop?: RegpopSpawnHooks113c
  readonly w2b1?: K2W2B1Hooks113c
  readonly w3b3?: K2W3B3Hooks113c
  readonly w3b5?: K2W3B5Hooks113c
  readonly world?: FallenSliceWorld113c
  readonly onSMemReAlloc?: (
    m: D2KernMemory113c,
    pOld: number,
    nBytes: number,
    dwFlags: number,
  ) => number
  readonly onSMemAlloc?: (m: D2KernMemory113c, nBytes: number) => number
  readonly onSMemFree?: (m: D2KernMemory113c, pMem: number) => void
  readonly onTryRollAndApplyMagicAffixes_6FC303C0?: (
    m: D2KernMemory113c,
    ppItem: number,
    pItemDrop: number,
  ) => number
  readonly onRollAndApplyMagicAffixesStrict_6FC30240?: (
    m: D2KernMemory113c,
    pItem: number,
    pItemDrop: number,
  ) => number
  readonly onRollRareAffixesExpansion_6FC35240?: (
    m: D2KernMemory113c,
    pItem: number,
    pItemDrop: number,
  ) => number
  readonly onRollRareAffixesClassic_6FC34F20?: (
    m: D2KernMemory113c,
    pItem: number,
    pItemDrop: number,
  ) => number
  readonly onRollWeightedDropClassIdByLevel_6FC2FFC0?: (
    m: D2KernMemory113c,
    pSeed: number,
    nLevelId: number,
    pGame: number,
    nRequiredType: number,
    bSkipRarityRoll: number,
    bAllowQuest0x28: number,
  ) => number
  readonly onFindDropRoomAtUnit_6FC2E930?: (
    m: D2KernMemory113c,
    pUnit: number,
    pCoords: number,
    pRoom: number,
    pOutRoom: number,
    bFlag: number,
  ) => number
  readonly onCreateItemFromDrop_6FC31490?: (
    m: D2KernMemory113c,
    pGame: number,
    pItemDrop: number,
    bFlag: number,
  ) => number
}

let k2W4B3StackPtr = 0x7e090000

function allocStackFrame113c(size: number, m?: D2KernMemory113c): number {
  const aligned = (size + 0x0f) & ~0x0f
  k2W4B3StackPtr = (k2W4B3StackPtr - aligned) >>> 0
  if (m !== undefined) {
    m.fill(k2W4B3StackPtr, aligned, 0)
  }
  return k2W4B3StackPtr
}

function freeStackFrame113c(size: number): void {
  const aligned = (size + 0x0f) & ~0x0f
  k2W4B3StackPtr = (k2W4B3StackPtr + aligned) >>> 0
}

/**
 * Resizes a `TSGrowableArray<TSExplicitList>` bucket array (`12` bytes per list element),
 * destroying excess tail lists when shrinking and relocating existing lists via
 * `STORM_TSListPlacementNewCopy_6FC226F0_113c` when `SMemReAlloc(..., 0x10)` cannot resize in place.
 *
 * @va D2Game:0x6FC22630
 */
export function STORM_TSListArrayResize_6FC22630_113c(
  m: D2KernMemory113c,
  pListArray: number,
  nNewCount: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC22630)
  const esi = pListArray >>> 0
  const ebx = nNewCount >>> 0
  const nOldAlloc = m.u32((esi + 0x04) >>> 0) >>> 0
  const pOldLists = m.u32((esi + 0x08) >>> 0) >>> 0

  if (ebx < nOldAlloc) {
    for (let edi = ebx; edi < (m.u32((esi + 0x04) >>> 0) >>> 0); edi = (edi + 1) >>> 0) {
      const pEntry = (pOldLists + imul32(edi, 12)) >>> 0
      STORM_TSListDestroySehWrapper_6FC21F60_113c(m, pEntry)
    }
  }

  const byteSize = (imul32(ebx, 3) << 2) >>> 0
  m.setU32((esi + 0x00) >>> 0, ebx)

  const pRealloc = hooks?.onSMemReAlloc
    ? hooks.onSMemReAlloc(m, pOldLists, byteSize, 0x10) >>> 0
    : 0
  m.setU32((esi + 0x08) >>> 0, pRealloc)
  if (pRealloc !== 0) {
    return
  }

  const pNewLists = hooks?.onSMemAlloc
    ? hooks.onSMemAlloc(m, byteSize) >>> 0
    : byteSize > 0
      ? m.alloc(byteSize) >>> 0
      : 0
  m.setU32((esi + 0x08) >>> 0, pNewLists)

  if (pOldLists !== 0) {
    let copyCount = m.u32((esi + 0x04) >>> 0) >>> 0
    if (ebx < copyCount) {
      copyCount = ebx
    }
    if (copyCount > 0) {
      let offset = 0
      for (let i = 0; i < copyCount; i++) {
        const pDst = (m.u32((esi + 0x08) >>> 0) + offset) >>> 0
        const pSrc = (pOldLists + offset) >>> 0
        STORM_TSListPlacementNewCopy_6FC226F0_113c(m, pDst, pSrc)
        STORM_TSListDestroySehWrapper_6FC21F60_113c(m, pSrc)
        offset = (offset + 12) >>> 0
      }
    }
    hooks?.onSMemFree?.(m, pOldLists)
  }
}

/**
 * Re-initializes an item candidate to Magic quality (`4`), restores its low seed from `*pdwSeed`,
 * invokes `ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c`, updates `*pdwSeed`, and rolls magic affixes (`0x6FC303C0`).
 *
 * @va D2Game:0x6FC304F0
 */
export function ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(
  m: D2KernMemory113c,
  ppItem: number,
  pdwSeed: number,
  pItemDrop: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC304F0)
  const edi = ppItem >>> 0
  const esi = pdwSeed >>> 0
  const ebx = pItemDrop >>> 0

  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, edi)
  const savedSeed = m.u32(esi) >>> 0
  const pItem0 = m.u32(edi) >>> 0
  ITEMS_SetOwnerGuid113c(m, pItem0, savedSeed)
  const pItemSeed0 = ITEMS_GetItemSeed113c(m, m.u32(edi) >>> 0) >>> 0
  SEED_InitLowSeed113c(m, pItemSeed0, m.u32(esi) >>> 0)

  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, m.u32(edi) >>> 0, ebx)
  ITEMS_SetItemQuality113c(m, m.u32(edi) >>> 0, 4)
  m.setU32((ebx + 0x30) >>> 0, 4)

  const pItemSeed1 = ITEMS_GetItemSeed113c(m, m.u32(edi) >>> 0) >>> 0
  const newLowSeed = SEED_GetLowSeed113c(m, pItemSeed1) >>> 0
  m.setU32(esi, newLowSeed)

  if (hooks?.onTryRollAndApplyMagicAffixes_6FC303C0) {
    return hooks.onTryRollAndApplyMagicAffixes_6FC303C0(m, edi, ebx) | 0
  }
  if (isAffixTablesLoaded113c(m)) {
    return ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(m, edi, ebx) | 0
  }
  return 1
}

/**
 * Applies item-type-specific post-creation modifiers for body parts (`7`, `40`), charms (`13`),
 * scrolls (`22`), tomes (`18`), and general items (`0x6FC30600`).
 *
 * @va D2Game:0x6FC30600
 */
export function ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
  nSpellArg = 0,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC30600)
  const esi = pItem >>> 0
  const ebx = pItemDrop >>> 0
  const nItemType = ITEMS_GetItemTypeFromItem113c(m, esi) | 0

  switch (nItemType) {
    case 7: {
      let nCell = m.u32((ebx + 0x40) >>> 0) >>> 0
      const pSourceUnit = m.u32((ebx + 0x00) >>> 0) >>> 0
      if (pSourceUnit !== 0) {
        nCell = m.u32((pSourceUnit + 0x04) >>> 0) >>> 0
      }
      ITEMS_SetItemCell113c(m, esi, nCell)
      ITEMS_SetOrClearCommandFlags113c(m, esi, 0x10000, 1)
      return
    }
    case 13: {
      if (hooks?.onRollAndApplyMagicAffixesStrict_6FC30240) {
        hooks.onRollAndApplyMagicAffixesStrict_6FC30240(m, esi, ebx)
      } else if (isSgptDataTablesLoaded113c(m)) {
        ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(m, esi, ebx)
      }
      return
    }
    case 18: {
      const wSuffix = ITEMS_FindSuperiorQualityRecordIndex113c(m, esi, 0) & 0xffff
      ITEMS_SetMagicSuffix113c(m, esi, wSuffix, 0)
      return
    }
    case 22: {
      const wSuffix = ITEMS_FindSuperiorQualityRecordIndex113c(m, esi, 1) & 0xffff
      ITEMS_SetMagicSuffix113c(m, esi, wSuffix, 0)
      return
    }
    case 40: {
      let nCell = m.u32((ebx + 0x40) >>> 0) >>> 0
      const pSourceUnit = m.u32((ebx + 0x00) >>> 0) >>> 0
      if (pSourceUnit !== 0) {
        nCell = m.u32((pSourceUnit + 0x04) >>> 0) >>> 0
      }
      ITEMS_SetItemCell113c(m, esi, nCell)
      return
    }
    default: {
      ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, esi, ebx)
      ITEMS_RollAndApplySockets_6FC2EC90_113c(m, esi, ebx, nSpellArg | 0)
      return
    }
  }
}

/**
 * Re-initializes an item candidate to Rare quality (`6`), restores its low seed from `*pdwSeed`,
 * checks `ITEMS_IsRareQualityAllowed113c`, and dispatches to Expansion (`0x6FC35240`) or Classic (`0x6FC34F20`) rare affix generation.
 *
 * @va D2Game:0x6FC30730
 */
export function ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(
  m: D2KernMemory113c,
  ppItem: number,
  pdwSeed: number,
  pItemDrop: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC30730)
  const edi = ppItem >>> 0
  const esi = pdwSeed >>> 0
  const ebx = pItemDrop >>> 0

  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, edi)
  const savedSeed = m.u32(esi) >>> 0
  const pItem0 = m.u32(edi) >>> 0
  ITEMS_SetOwnerGuid113c(m, pItem0, savedSeed)
  const pItemSeed0 = ITEMS_GetItemSeed113c(m, m.u32(edi) >>> 0) >>> 0
  SEED_InitLowSeed113c(m, pItemSeed0, m.u32(esi) >>> 0)

  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, m.u32(edi) >>> 0, ebx)
  ITEMS_SetItemQuality113c(m, m.u32(edi) >>> 0, 6)
  m.setU32((ebx + 0x30) >>> 0, 6)

  const pItemSeed1 = ITEMS_GetItemSeed113c(m, m.u32(edi) >>> 0) >>> 0
  const newLowSeed = SEED_GetLowSeed113c(m, pItemSeed1) >>> 0
  m.setU32(esi, newLowSeed)

  const pItem1 = m.u32(edi) >>> 0
  if (ITEMS_IsRareQualityAllowed113c(m, pItem1) === 0) {
    return 0
  }
  const wFormat = ITEMS_GetItemFormat113c(m, pItem1) & 0xffff
  if (wFormat >= 1) {
    if (hooks?.onRollRareAffixesExpansion_6FC35240) {
      return hooks.onRollRareAffixesExpansion_6FC35240(m, pItem1, ebx) | 0
    }
    return isAffixTablesLoaded113c(m)
      ? ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(m, pItem1, ebx) | 0
      : 1
  }
  if (hooks?.onRollRareAffixesClassic_6FC34F20) {
    return hooks.onRollRareAffixesClassic_6FC34F20(m, pItem1, ebx) | 0
  }
  return isAffixTablesLoaded113c(m)
    ? ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(m, pItem1, ebx) | 0
    : 1
}

/**
 * Rolls an item classId matching `nRequiredItemType` at `pUnit`'s drop level (or forced code at `pUnit + 0xB8`),
 * populates a `0x84`-byte `D2ItemDropStrc`, and creates/drops the item (`0x6FC31A70`).
 *
 * @va D2Game:0x6FC31A70
 */
export function ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nQuality: number,
  pInOutItemLevel: number,
  pOutItemDrop: number,
  nRequiredItemType: number,
  bSkipRarityRoll: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC31A70)
  const ebx = pGame >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('pGame != NULL', 2503)
  }

  const edi = pUnit >>> 0
  const pSeed = (edi + 0x20) >>> 0
  const bAllowQuest0x28 = edi !== 0 && (m.u32(edi) | 0) === 1 ? 1 : 0

  const nDropIlvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, ebx, edi, 0) | 0
  m.setU32(pInOutItemLevel >>> 0, nDropIlvl >>> 0)

  let nClassId = 0
  const dwForcedCode = m.u32((edi + 0xb8) >>> 0) >>> 0
  if (dwForcedCode !== 0) {
    nClassId = DATATBLS_GetItemIdFromItemCode113c(m, dwForcedCode) | 0
    if (nClassId === -1) {
      throw new D2CommonAssertError('nItemId != -1', 2538)
    }
  } else {
    nClassId = hooks?.onRollWeightedDropClassIdByLevel_6FC2FFC0
      ? hooks.onRollWeightedDropClassIdByLevel_6FC2FFC0(
          m,
          pSeed,
          nDropIlvl,
          ebx,
          nRequiredItemType | 0,
          bSkipRarityRoll | 0,
          bAllowQuest0x28,
        ) | 0
      : ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(
          m,
          pSeed,
          nDropIlvl,
          ebx,
          nRequiredItemType | 0,
          bSkipRarityRoll | 0,
          bAllowQuest0x28,
        ) | 0

    if ((nQuality | 0) === 4) {
      let retryCount = 0
      let pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
      while (pItemsTxt === 0 || (m.u8((pItemsTxt + 0xdc) >>> 0) & 0x01) === 0) {
        const curIlvl = m.u32(pInOutItemLevel >>> 0) | 0
        if (retryCount > 10) {
          nClassId =
            ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(
              m,
              nRequiredItemType | 0,
              ebx,
              pSeed,
              curIlvl,
              bSkipRarityRoll | 0,
            ) | 0
        } else {
          nClassId = hooks?.onRollWeightedDropClassIdByLevel_6FC2FFC0
            ? hooks.onRollWeightedDropClassIdByLevel_6FC2FFC0(
                m,
                pSeed,
                curIlvl,
                ebx,
                nRequiredItemType | 0,
                bSkipRarityRoll | 0,
                bAllowQuest0x28,
              ) | 0
            : ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(
                m,
                pSeed,
                curIlvl,
                ebx,
                nRequiredItemType | 0,
                bSkipRarityRoll | 0,
                bAllowQuest0x28,
              ) | 0
        }
        pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
        retryCount = (retryCount + 1) | 0
        if (retryCount > 12 && pItemsTxt === 0) {
          break
        }
      }
    }
  }

  const pFrame = allocStackFrame113c(0xa0, m)
  try {
    const pOutCoords = (pFrame + 0x08) >>> 0
    const pCoords = (pFrame + 0x10) >>> 0
    const pDrop = (pFrame + 0x18) >>> 0

    PATH_GetTargetTypeAndPosition113c(m, edi, pCoords)
    m.setU32(pOutCoords, m.u32(pCoords))
    m.setU32((pOutCoords + 0x04) >>> 0, m.u32((pCoords + 0x04) >>> 0))
    const pUnitRoom = UNITS_GetRoom113c(m, edi) >>> 0
    const pResolvedRoom = hooks?.onFindDropRoomAtUnit_6FC2E930
      ? hooks.onFindDropRoomAtUnit_6FC2E930(m, edi, pCoords, pUnitRoom, pOutCoords, 1) >>> 0
      : ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pUnitRoom, pCoords, pOutCoords, 1) >>> 0

    if (pResolvedRoom === 0) {
      return 0
    }

    for (let i = 0; i < 0x21; i++) {
      m.setU32((pDrop + (i << 2)) >>> 0, 0)
    }

    const wItemFormat = m.u16((ebx + 0x78) >>> 0) & 0xffff
    m.setU32((pDrop + 0x00) >>> 0, edi)
    m.setU32((pDrop + 0x04) >>> 0, 0)
    m.setU32((pDrop + 0x08) >>> 0, ebx)
    m.setU32((pDrop + 0x0c) >>> 0, m.u32(pInOutItemLevel >>> 0) >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 3)
    m.setU32((pDrop + 0x1c) >>> 0, m.u32(pOutCoords) >>> 0)
    m.setU32((pDrop + 0x20) >>> 0, m.u32((pOutCoords + 0x04) >>> 0) >>> 0)
    m.setU32((pDrop + 0x24) >>> 0, pResolvedRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, wItemFormat)
    m.setU32((pDrop + 0x30) >>> 0, nQuality >>> 0)

    const pCreatedItem = hooks?.onCreateItemFromDrop_6FC31490
      ? hooks.onCreateItemFromDrop_6FC31490(m, ebx, pDrop, 0) >>> 0
      : D2GAME_CreateItemEx_6FC31490_113c(m, ebx, pDrop, 0) >>> 0

    if ((pOutItemDrop >>> 0) !== 0) {
      for (let i = 0; i < 0x21; i++) {
        m.setU32(
          ((pOutItemDrop >>> 0) + (i << 2)) >>> 0,
          m.u32((pDrop + (i << 2)) >>> 0) >>> 0,
        )
      }
    }
    return pCreatedItem >>> 0
  } finally {
    freeStackFrame113c(0xa0)
  }
}

export interface K2W4B3Hooks113c {
  readonly onSpawnGoldPilesAtUnit_6FC32B90?: (
    m: D2KernMemory113c,
    pGame: number,
    pUnit: number,
    dwGoldAmount: number,
  ) => void
  readonly onApplySpectralHitElemDamage_6FC42B60?: (
    m: D2KernMemory113c,
    pGame: number,
    pTargetUnit: number,
    pAttackerMonster: number,
    pDamage: number,
  ) => void
  readonly onPackMemberDeathCallback_6FC43730?: (
    m: D2KernMemory113c,
    pPackMember: number,
    pArg1: number,
    pArg2: number,
  ) => void
  readonly onMonsterStartMode_6FC95E10?: (
    m: D2KernMemory113c,
    pGame: number,
    pModeArgs: number,
    bCheckSequence: number,
  ) => number
}

/**
 * Spawns a random item in `pRoom` near `pCoords` (`+2, +3` subtile offset when inside the room),
 * clamping `ilvl` from `DATATBLS_GetLevelMonsterLevel113c - 1` into `[1, 64]` (`0x6FC32230`).
 *
 * @va D2Game:0x6FC32230
 */
export function ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(
  m: D2KernMemory113c,
  pCoords: number,
  pGame: number,
  pRoom: number,
  pOutItemDrop: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC32230)
  const ebx = pCoords >>> 0
  const ediGame = pGame >>> 0
  const esiRoom = pRoom >>> 0

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, esiRoom) | 0
  const bExpansion = m.u32((ediGame + 0x70) >>> 0) | 0
  const nDifficulty = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  let ilvl = DATATBLS_GetLevelMonsterLevel113c(m, nLevelId, nDifficulty, bExpansion) | 0
  if (ilvl > 1) {
    ilvl = (ilvl - 1) | 0
  }
  if (ilvl >= 0x41) {
    ilvl = 0x40
  }

  const pSeed = esiRoom !== 0 ? (esiRoom + 0x6c) >>> 0 : 0
  const nClassId = hooks?.onRollWeightedDropClassIdByLevel_6FC2FFC0
    ? hooks.onRollWeightedDropClassIdByLevel_6FC2FFC0(
        m,
        pSeed,
        ilvl,
        ediGame,
        -1,
        0,
        0,
      ) | 0
    : ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(
        m,
        pSeed,
        ilvl,
        ediGame,
        -1,
        0,
        0,
      ) | 0

  const origX = m.u32(ebx) | 0
  const origY = m.u32((ebx + 0x04) >>> 0) | 0
  const offX = (origX + 2) | 0
  const offY = (origY + 3) | 0
  const pOffsetRoom = ROOM_FindRoomContainingSubtile113c(m, esiRoom, offX, offY) >>> 0
  const boxX = pOffsetRoom !== 0 ? offX : origX
  const boxY = pOffsetRoom !== 0 ? offY : origY

  const pFrame = allocStackFrame113c(0xa0, m)
  try {
    const pFieldBox = (pFrame + 0x00) >>> 0
    const pOutFreeCoords = (pFrame + 0x08) >>> 0
    const pDrop = (pFrame + 0x10) >>> 0

    m.setU32((pFieldBox + 0x00) >>> 0, origX >>> 0)
    m.setU32((pFieldBox + 0x04) >>> 0, origY >>> 0)
    m.setU32((pOutFreeCoords + 0x00) >>> 0, boxX >>> 0)
    m.setU32((pOutFreeCoords + 0x04) >>> 0, boxY >>> 0)

    const pFreeRoom =
      COLLISION_FindFreePositionBasic113c(
        m,
        esiRoom,
        pOutFreeCoords,
        pFieldBox,
        1,
        0x3e01,
        0x801,
        1,
      ) >>> 0
    if (pFreeRoom === 0) {
      return 0
    }

    for (let i = 0; i < 0x21; i++) {
      m.setU32((pDrop + (i << 2)) >>> 0, 0)
    }

    const wItemFormat = m.u16((ediGame + 0x78) >>> 0) & 0xffff
    m.setU32((pDrop + 0x00) >>> 0, 0)
    m.setU32((pDrop + 0x04) >>> 0, pSeed)
    m.setU32((pDrop + 0x08) >>> 0, ediGame)
    m.setU32((pDrop + 0x0c) >>> 0, ilvl >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 3)
    m.setU32((pDrop + 0x1c) >>> 0, m.u32(pOutFreeCoords) >>> 0)
    m.setU32((pDrop + 0x20) >>> 0, m.u32((pOutFreeCoords + 0x04) >>> 0) >>> 0)
    m.setU32((pDrop + 0x24) >>> 0, pFreeRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, wItemFormat)
    m.setU32((pDrop + 0x30) >>> 0, 0)

    const pItem = hooks?.onCreateItemFromDrop_6FC31490
      ? hooks.onCreateItemFromDrop_6FC31490(m, ediGame, pDrop, 0) >>> 0
      : D2GAME_CreateItemEx_6FC31490_113c(m, ediGame, pDrop, 0) >>> 0

    if ((pOutItemDrop >>> 0) !== 0) {
      for (let i = 0; i < 0x21; i++) {
        m.setU32(
          ((pOutItemDrop >>> 0) + (i << 2)) >>> 0,
          m.u32((pDrop + (i << 2)) >>> 0) >>> 0,
        )
      }
    }
    return pItem >>> 0
  } finally {
    freeStackFrame113c(0xa0)
  }
}

/**
 * Adds `dwGoldAmount` to `pPlayerUnit`'s inventory gold (`STAT_GOLD = 14`), clamping at
 * `STATLIST_GetUnitGoldBankLimit113c` and dropping any overflow on the ground via `0x6FC32B90`.
 *
 * @va D2Game:0x6FC32DF0
 */
export function ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
  dwGoldAmount: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC32DF0)
  const esi = pPlayerUnit >>> 0
  const ecxGame = pGame >>> 0
  const nGold = dwGoldAmount >>> 0

  const maxGold = STATLIST_GetUnitGoldBankLimit113c(m, esi) >>> 0
  const curGold = STATLIST_GetUnitStat113c(m, esi, 14, 0) >>> 0
  if (curGold === maxGold) {
    if (hooks !== undefined && hooks.onSpawnGoldPilesAtUnit_6FC32B90 !== undefined) {
      hooks.onSpawnGoldPilesAtUnit_6FC32B90(m, ecxGame, esi, nGold)
    } else {
      ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, ecxGame, esi, nGold)
    }
    return
  }

  const totalGold = (curGold + nGold) >>> 0
  if (totalGold > maxGold) {
    const deltaToCap = (maxGold - curGold) | 0
    if (esi !== 0) {
      const nowGold = STATLIST_GetUnitStat113c(m, esi, 14, 0) | 0
      const candidateGold = (nowGold + deltaToCap) | 0
      if (
        candidateGold < 0 ||
        ((m.u32(esi) | 0) === 0 &&
          candidateGold > (STATLIST_GetUnitGoldBankLimit113c(m, esi) | 0))
      ) {
        STATLIST_SetUnitStat113c(m, esi, 14, 0, 0)
      } else {
        STATLIST_AddUnitStatMemPort113c(m, esi, 14, deltaToCap, 0)
      }
    }
    const overflowGold = ((curGold - maxGold) + nGold) >>> 0
    if (hooks !== undefined && hooks.onSpawnGoldPilesAtUnit_6FC32B90 !== undefined) {
      hooks.onSpawnGoldPilesAtUnit_6FC32B90(m, ecxGame, esi, overflowGold)
    } else {
      ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, ecxGame, esi, overflowGold)
    }
    return
  }

  if (esi !== 0) {
    const nowGold = STATLIST_GetUnitStat113c(m, esi, 14, 0) | 0
    const candidateGold = (nowGold + (nGold | 0)) | 0
    if (
      candidateGold < 0 ||
      ((m.u32(esi) | 0) === 0 &&
        candidateGold > (STATLIST_GetUnitGoldBankLimit113c(m, esi) | 0))
    ) {
      STATLIST_SetUnitStat113c(m, esi, 14, 0, 0)
      return
    }
    STATLIST_AddUnitStatMemPort113c(m, esi, 14, nGold | 0, 0)
  }
}

/**
 * Checks `ITEMS_IsRareQualityAllowed113c` and dispatches rare affix rolling to Expansion (`0x6FC35240`)
 * or Classic (`0x6FC34F20`) based on `ITEMS_GetItemFormat113c >= 1`.
 *
 * @va D2Game:0x6FC354F0
 */
export function ITEMS_RollRareAffixesByFormat_6FC354F0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC354F0)
  const esi = pItem >>> 0
  const edi = pItemDrop >>> 0
  if (ITEMS_IsRareQualityAllowed113c(m, esi) === 0) {
    return 0
  }
  const wFormat = ITEMS_GetItemFormat113c(m, esi) & 0xffff
  if (wFormat >= 1) {
    if (hooks?.onRollRareAffixesExpansion_6FC35240) {
      return hooks.onRollRareAffixesExpansion_6FC35240(m, esi, edi) | 0
    }
    return isAffixTablesLoaded113c(m)
      ? ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(m, esi, edi) | 0
      : 1
  }
  if (hooks?.onRollRareAffixesClassic_6FC34F20) {
    return hooks.onRollRareAffixesClassic_6FC34F20(m, esi, edi) | 0
  }
  return isAffixTablesLoaded113c(m)
    ? ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(m, esi, edi) | 0
    : 1
}

/**
 * Monster Unique Modifier `#27` (Spectral Hit) missile damage wrapper: forwards to `0x6FC42B60`
 * when `pMonster != NULL` (`[esp+0x8]`) and `pTargetUnit` is a missile (`dwUnitType == 3`).
 *
 * @va D2Game:0x6FC43650
 */
export function MONUMOD_SpectralHitMissileDamage_6FC43650_113c(
  m: D2KernMemory113c,
  pGame: number,
  pTargetUnit: number,
  pAttackerMonster: number,
  pDamage?: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC43650)
  const monsterOrFlag = (pDamage !== undefined ? pDamage : pAttackerMonster) >>> 0
  const target = pTargetUnit >>> 0
  if (monsterOrFlag !== 0 && target !== 0 && (m.u32(target) | 0) === 3) {
    if (hooks !== undefined && hooks.onApplySpectralHitElemDamage_6FC42B60 !== undefined) {
      hooks.onApplySpectralHitElemDamage_6FC42B60(
        m,
        pGame >>> 0,
        target,
        pAttackerMonster >>> 0,
        monsterOrFlag,
      )
    } else {
      MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(
        m,
        pGame >>> 0,
        target,
        pAttackerMonster >>> 0,
        monsterOrFlag,
      )
    }
  }
}

/**
 * Handles pack-linked monster death propagation (`0x6FC43BF0`): iterates pack members via `0x6FC41490`,
 * clears the boss unit's `pAiGeneral` link (`+0x28..+0x30`), and transitions the boss to `MONMODE_DEATH (0)`.
 *
 * @va D2Game:0x6FC43BF0
 */
export function MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  _pAttacker = 0,
  _dwArg = 0,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC43BF0)
  const ebp = pGame >>> 0
  const esi = pMonster >>> 0
  if (esi === 0) return
  if (m.u32((esi + 0x10) >>> 0) !== 0) return
  if ((m.u32(esi) | 0) !== 1) return

  const pMonData = m.u32((esi + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0) return

  const pBossGame = m.u32((pAiGeneral + 0x28) >>> 0) >>> 0
  if (pBossGame === 0) return
  const dwBossId = m.u32((pAiGeneral + 0x2c) >>> 0) >>> 0
  const dwBossType = m.u32((pAiGeneral + 0x30) >>> 0) >>> 0

  const ediBoss = SUNIT_GetServerUnit113c(m, pBossGame, dwBossType, dwBossId) >>> 0
  if (ediBoss === 0) return

  AIGENERAL_ForEachPackMember_6FC41490_113c(
    m,
    esi,
    hooks !== undefined && hooks.onPackMemberDeathCallback_6FC43730 !== undefined
      ? hooks.onPackMemberDeathCallback_6FC43730
      : MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c,
    ebp,
    0,
    hooks !== undefined ? hooks.laneI : undefined,
  )

  if ((m.u32(ediBoss) | 0) === 1) {
    const pBossMonData = m.u32((ediBoss + 0x14) >>> 0) >>> 0
    const pBossAiGeneral = pBossMonData !== 0 ? m.u32((pBossMonData + 0x28) >>> 0) >>> 0 : 0
    if (pBossAiGeneral !== 0) {
      m.setU32((pBossAiGeneral + 0x2c) >>> 0, 0xffffffff)
      m.setU32((pBossAiGeneral + 0x30) >>> 0, 1)
      m.setU32((pBossAiGeneral + 0x28) >>> 0, ebp)
    }
  }

  if (ediBoss !== esi && (m.u32(ediBoss) | 0) === 1) {
    const pModeChange = allocStackFrame113c(0x20, m)
    try {
      MONSTER_InitModeChangeStrc113c(m, ediBoss, pModeChange, 0)
      if (hooks !== undefined && hooks.world !== undefined) {
        MONSTER_StartMode113c(hooks.world, ediBoss, 0, 0, 0, 0)
      } else if (hooks !== undefined && hooks.onMonsterStartMode_6FC95E10 !== undefined) {
        hooks.onMonsterStartMode_6FC95E10(m, ebp, pModeChange, 1)
      } else {
        hitD2GameVa113c(0x6FC95E10)
        MONSTER_StartModeReal113c(m, ebp, ediBoss, 0, 0, 0, 0)
      }
    } finally {
      freeStackFrame113c(0x20)
    }
  }
}

export interface K2W4B3Hooks113c {
  readonly onRollChampionUMod_6FC43AE0?: (
    m: D2KernMemory113c,
    pGame: number,
    pMonster: number,
  ) => number
  readonly onRollRandomUniqueUMod_6FC43980?: (
    m: D2KernMemory113c,
    pGame: number,
    pMonster: number,
    pUsedFlags: number,
  ) => number
  readonly onApplyMonsterUModsAndSpawnMinions_6FC448A0?: (
    m: D2KernMemory113c,
    bFlag1: number,
    nArg0: number,
    pGame: number,
    pRoom: number,
    pMonster: number,
    nArg1: number,
    nArg2: number,
  ) => void
  readonly onIsGameNameAvailable_6FC4ABD0?: (
    m: D2KernMemory113c,
    szGameName: number,
  ) => number
  readonly onSpawnRandomMiscItemInRoomAtCoords_6FC31CA0?: (
    m: D2KernMemory113c,
    pCoords: number,
    pGame: number,
    pRoom: number,
    nRequiredType: number,
    bSkipRarityRoll: number,
    pOwnerUnit: number,
  ) => number
  readonly onApplyDemonUndeadElemBonus_6FC5A790?: (
    m: D2KernMemory113c,
    pGame: number,
    pMissile: number,
    pTargetUnit: number,
    pDamage: number,
  ) => void
}

function rollSeedAtPtr113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const s = {
    lo: m.u32(pSeed >>> 0) >>> 0,
    hi: m.u32((pSeed + 0x04) >>> 0) >>> 0,
  }
  const res = seedRoll(s, nMax) | 0
  m.setU32(pSeed >>> 0, s.lo >>> 0)
  m.setU32((pSeed + 0x04) >>> 0, s.hi >>> 0)
  return res
}

function writeCString113c(m: D2KernMemory113c, dstPtr: number, text: string): void {
  const dst = dstPtr >>> 0
  for (let i = 0; i < text.length; i++) {
    m.setU8((dst + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((dst + text.length) >>> 0, 0)
}

function readCString113c(m: D2KernMemory113c, srcPtr: number, maxLen = 64): string {
  const src = srcPtr >>> 0
  let out = ''
  for (let i = 0; i < maxLen; i++) {
    const ch = m.u8((src + i) >>> 0) & 0xff
    if (ch === 0) break
    out += String.fromCharCode(ch)
  }
  return out
}

/**
 * Rolls Champion (`0x6FC43AE0`) or Unique (`0x6FC43980`) monster modifiers (`MonUMod`) onto `pMonster`
 * based on game difficulty (`pGame + 0x6D < 3`) and `bAllowChampion` (`0x6FC43CA0`).
 *
 * @va D2Game:0x6FC43CA0
 */
export function MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  bAllowChampion: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC43CA0)
  const ediGame = pGame >>> 0
  if (ediGame === 0) return
  if ((m.u8((ediGame + 0x6d) >>> 0) & 0xff) >= 3) return

  const esiMon = pMonster >>> 0
  if (esiMon === 0) return
  if ((m.u32(esiMon) | 0) !== 1) return

  const pMonData = m.u32((esiMon + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pUModBytes = (pMonData + 0x1c) >>> 0
  if (pUModBytes === 0) return

  const ebxExisting = MONUMOD_CountUnitUMods113c(m, pUModBytes) | 0
  if (ebxExisting >= 8) return

  const pSeed = (esiMon + 0x20) >>> 0
  if (pSeed === 0) return

  if ((bAllowChampion | 0) !== 0) {
    const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
    const sgptDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    const nMonUModCount =
      sgptDataTables !== 0 ? m.u32((sgptDataTables + 0xc54) >>> 0) | 0 : 0
    let nChampChance = 0
    if (nMonUModCount > 0) {
      const pMonUModTxt = m.u32((sgptDataTables + 0xc50) >>> 0) >>> 0
      if (pMonUModTxt !== 0) {
        nChampChance = m.u32((pMonUModTxt + 0x1c) >>> 0) | 0
      }
    }
    const roll100 = rollSeedAtPtr113c(m, pSeed, 100) | 0
    if (roll100 < nChampChance) {
      if ((m.u32(esiMon) | 0) === 1) {
        const pMD = m.u32((esiMon + 0x14) >>> 0) >>> 0
        if (pMD !== 0) {
          m.setU8((pMD + 0x16) >>> 0, (m.u8((pMD + 0x16) >>> 0) | 0x04) & 0xff)
        }
      }
      const nChampUMod =
        hooks !== undefined && hooks.onRollChampionUMod_6FC43AE0 !== undefined
          ? hooks.onRollChampionUMod_6FC43AE0(m, ediGame, esiMon) | 0
          : MONUMOD_RollRandomChampionMod_6FC43AE0_113c(m, ediGame, esiMon) | 0
      MONUMOD_AppendUModToMonster113c(m, esiMon, nChampUMod)
      return
    }
  }

  const roll1 = rollSeedAtPtr113c(m, pSeed, 1) | 0
  const nDiff = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  let nToRoll = (roll1 + 1 + nDiff) | 0
  if (nToRoll + ebxExisting >= 9) {
    nToRoll = (9 - ebxExisting) | 0
  }

  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const sgptDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  const nMonUModCount =
    sgptDataTables !== 0 ? m.u32((sgptDataTables + 0xc54) >>> 0) >>> 0 : 0
  const clearLen = nMonUModCount > 0x100 ? nMonUModCount : 0x100

  const pUsedFlags = allocStackFrame113c(clearLen)
  try {
    for (let i = 0; i < clearLen; i++) {
      m.setU8((pUsedFlags + i) >>> 0, 0)
    }
    for (let i = 0; i < ebxExisting; i++) {
      const bMod = m.u8((pUModBytes + i) >>> 0) & 0xff
      m.setU8((pUsedFlags + bMod) >>> 0, 1)
    }

    let pWrite = (pUModBytes + ebxExisting) >>> 0
    while (nToRoll !== 0) {
      const nPicked =
        hooks !== undefined && hooks.onRollRandomUniqueUMod_6FC43980 !== undefined
          ? hooks.onRollRandomUniqueUMod_6FC43980(m, ediGame, esiMon, pUsedFlags) | 0
          : MONUMOD_RollRandomUniqueBossMod_6FC43980_113c(m, ediGame, esiMon, pUsedFlags) | 0
      if (nPicked === 0) break
      nToRoll = (nToRoll - 1) | 0
      m.setU8(pWrite, nPicked & 0xff)
      pWrite = (pWrite + 1) >>> 0
      m.setU8((pUsedFlags + (nPicked & 0xff)) >>> 0, 1)
    }
  } finally {
    freeStackFrame113c(clearLen)
  }
}

/**
 * Promotes a non-Champion monster to a Boss/Unique (`flags |= 0x05`), appends `bUModId` to its
 * `MonUMod` list (`pMonData + 0x1C`), and invokes `0x6FC448A0` (`0x6FC44BF0`).
 *
 * @va D2Game:0x6FC44BF0
 */
export function MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pGame: number,
  bUModId: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC44BF0)
  const edi = pMonster >>> 0
  const esi = pGame >>> 0
  if (edi === 0) return
  if ((m.u32(edi) | 0) !== 1) return

  const pMonData0 = m.u32((edi + 0x14) >>> 0) >>> 0
  if (pMonData0 === 0) return
  const pUModBytes = (pMonData0 + 0x1c) >>> 0
  if (pUModBytes === 0) return

  if ((m.u8((pMonData0 + 0x16) >>> 0) & 0x04) !== 0) {
    return
  }

  MONUMOD_MarkBossAndIncrementUniqueCount113c(m, edi, esi)
  if ((m.u32(edi) | 0) === 1) {
    const pMonData1 = m.u32((edi + 0x14) >>> 0) >>> 0
    if (pMonData1 !== 0) {
      m.setU8((pMonData1 + 0x16) >>> 0, (m.u8((pMonData1 + 0x16) >>> 0) | 0x05) & 0xff)
    }
  }

  const nCount = MONUMOD_CountUnitUMods113c(m, pUModBytes) | 0
  if (nCount < 9) {
    m.setU8((pUModBytes + nCount) >>> 0, bUModId & 0xff)
    const pRoom = UNITS_GetRoom113c(m, edi) >>> 0
    if (hooks !== undefined && hooks.onApplyMonsterUModsAndSpawnMinions_6FC448A0 !== undefined) {
      hooks.onApplyMonsterUModsAndSpawnMinions_6FC448A0(
        m,
        1,
        0,
        esi,
        pRoom,
        edi,
        0,
        0,
      )
    } else {
      MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 1, pRoom, esi, edi, 0)
    }
  }
}

/**
 * Assigns a unique game name into `pGame + 0x2A`, appending `%d` (`0..99`) when `szBaseName`
 * is already in use according to `0x6FC4ABD0` (`0x6FC4BC90`).
 *
 * @va D2Game:0x6FC4BC90
 */
export function GAME_AssignUniqueGameName_6FC4BC90_113c(
  m: D2KernMemory113c,
  pGame: number,
  szBaseName: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC4BC90)
  const ebx = pGame >>> 0
  const edi = szBaseName >>> 0

  const bInitialOk =
    hooks !== undefined && hooks.onIsGameNameAvailable_6FC4ABD0 !== undefined
      ? hooks.onIsGameNameAvailable_6FC4ABD0(m, edi) | 0
      : GAME_IsGameNameAvailable_6FC4ABD0_113c(m, edi) | 0
  if (bInitialOk !== 0) {
    const baseStr = readCString113c(m, edi)
    writeCString113c(m, (ebx + 0x2a) >>> 0, baseStr)
    return
  }

  const rawBase = readCString113c(m, edi)
  if (((15 - rawBase.length) >>> 0) < 3) {
    m.setU8((edi + 0x0b) >>> 0, 0)
  }
  const truncatedBase = readCString113c(m, edi)

  const pCandidate = allocStackFrame113c(0x20, m)
  try {
    writeCString113c(m, pCandidate, `${truncatedBase}~0`)
    let esiSuffix = 1
    let bAvail =
      hooks !== undefined && hooks.onIsGameNameAvailable_6FC4ABD0 !== undefined
        ? hooks.onIsGameNameAvailable_6FC4ABD0(m, pCandidate) | 0
        : GAME_IsGameNameAvailable_6FC4ABD0_113c(m, pCandidate) | 0

    while (bAvail === 0) {
      if (esiSuffix >= 100) {
        throw new D2CommonAssertError('i < 100', 604)
      }
      writeCString113c(m, pCandidate, `${truncatedBase}~${esiSuffix}`)
      esiSuffix = (esiSuffix + 1) | 0
      bAvail =
        hooks !== undefined && hooks.onIsGameNameAvailable_6FC4ABD0 !== undefined
          ? hooks.onIsGameNameAvailable_6FC4ABD0(m, pCandidate) | 0
          : GAME_IsGameNameAvailable_6FC4ABD0_113c(m, pCandidate) | 0
    }

    if (esiSuffix >= 100) {
      throw new D2CommonAssertError('i < 100', 604)
    }
    const finalName = readCString113c(m, pCandidate)
    writeCString113c(m, (ebx + 0x2a) >>> 0, finalName)
  } finally {
    freeStackFrame113c(0x20)
  }
}

/**
 * Validates and drops `nGoldToDrop` from `pPlayerUnit`'s inventory onto the ground as a gold item
 * (`nRequiredType = 4`), deducting the gold via `STATLIST_SetUnitStatGoldGuarded_6FC21040_113c`.
 *
 * @va D2Game:0x6FC57F80
 */
export function PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwPlayerUnitId: number,
  pPlayerUnit: number,
  nGoldToDrop: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC57F80)
  const esiGame = pGame >>> 0
  if (esiGame === 0) {
    throw new D2CommonAssertError('pGame != NULL', 723)
  }

  const bucketIdx = (dwPlayerUnitId & 0x7f) >>> 0
  let pNode = m.u32((esiGame + 0x1120 + (bucketIdx << 2)) >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u32((pNode + 0x0c) >>> 0) >>> 0) === (dwPlayerUnitId >>> 0)) {
      break
    }
    pNode = m.u32((pNode + 0xe4) >>> 0) >>> 0
  }

  const ebpPlayer = pPlayerUnit >>> 0
  if (pNode !== ebpPlayer) {
    return 0
  }

  const curGold = STATLIST_GetUnitStat113c(m, ebpPlayer, 14, 0) | 0
  const ediGold = nGoldToDrop | 0
  if (ediGold > curGold || ediGold < 0) {
    return 0
  }

  const maxGold = STATLIST_GetUnitGoldBankLimit113c(m, ebpPlayer) | 0
  if (ediGold > maxGold) {
    return 0
  }

  if ((ediGold >>> 0) > 0) {
    const pCoords = allocStackFrame113c(0x10, m)
    try {
      PATH_GetTargetTypeAndPosition113c(m, ebpPlayer, pCoords)
      let clampedGold = ediGold >>> 0
      if (clampedGold > 0x77359400) {
        clampedGold = 0x77359400
      }
      const pRoom = UNITS_GetRoom113c(m, ebpPlayer) >>> 0
      const pGoldItem =
        hooks !== undefined && hooks.onSpawnRandomMiscItemInRoomAtCoords_6FC31CA0 !== undefined
          ? hooks.onSpawnRandomMiscItemInRoomAtCoords_6FC31CA0(
              m,
              pCoords,
              esiGame,
              pRoom,
              4,
              1,
              ebpPlayer,
            ) >>> 0
          : ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(
              m,
              pCoords,
              esiGame,
              pRoom,
              4,
              1,
              ebpPlayer,
            ) >>> 0

      if (pGoldItem !== 0) {
        STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pGoldItem, 14, clampedGold)
        if (ebpPlayer !== 0 && (m.u32(ebpPlayer) | 0) === 0) {
          STATES_UpdateOrClearState98Transform113c(m, pGoldItem, ebpPlayer)
        }
        const newGold = (STATLIST_GetUnitStat113c(m, ebpPlayer, 14, 0) - ediGold) | 0
        STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, ebpPlayer, 14, newGold)
      }
    } finally {
      freeStackFrame113c(0x10)
    }
  }
  return 1
}

/**
 * Scales missile physical damage (`pDamage + 0x08`) by its owner's `STAT_DAMAGEPERCENT (25)`
 * when `(pMissile->dwFlags >> 10) & 1` is set and `pTargetUnit` is a monster (`1`), then calls `0x6FC5A790`.
 *
 * @va D2Game:0x6FC5AAA0
 */
export function MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  pDamage: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC5AAA0)
  const ebpGame = pGame >>> 0
  const ediMissile = pMissile >>> 0
  const esiTarget = pTargetUnit >>> 0
  const ebxDamage = pDamage >>> 0

  if (esiTarget === 0) return
  if ((m.u32(esiTarget) | 0) !== 1) return

  if (ediMissile !== 0) {
    const hasOwnerBit = ((m.u32((ediMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0
    if (hasOwnerBit) {
      const dwOwnerType = m.u32((ediMissile + 0x94) >>> 0) >>> 0
      const dwOwnerId = m.u32((ediMissile + 0x98) >>> 0) >>> 0
      const pOwner = SUNIT_GetServerUnit113c(m, ebpGame, dwOwnerType, dwOwnerId) >>> 0
      if (pOwner !== 0) {
        const physDmg = m.u32((ebxDamage + 0x08) >>> 0) | 0
        const pctStat = STATLIST_GetUnitStat113c(m, pOwner, 0x19, 0) | 0
        const bonusDmg = sdiv32(imul32(pctStat, physDmg), 100)
        m.setU32((ebxDamage + 0x08) >>> 0, (physDmg + bonusDmg) >>> 0)
      }
    }
  }

  if (hooks !== undefined && hooks.onApplyDemonUndeadElemBonus_6FC5A790 !== undefined) {
    hooks.onApplyDemonUndeadElemBonus_6FC5A790(
      m,
      ebpGame,
      ediMissile,
      esiTarget,
      ebxDamage,
    )
  } else {
    MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(
      m,
      ebpGame,
      ediMissile,
      esiTarget,
      ebxDamage,
    )
  }
}

export interface K2W4B3Hooks113c {
  readonly onSpawnMonster209NearUnitOffsetMinus5_6FC7C1F0?: (
    m: D2KernMemory113c,
    pUnit: number,
    pGame: number,
    pRoom: number,
  ) => void
  readonly onApplySecondaryAuraAndSpawnChargedMissile_6FC663A0?: (
    m: D2KernMemory113c,
    pGame: number,
    pOwner: number,
    nDuration: number,
    nSkillId: number,
    nSkillLevel: number,
    nChargeLevel: number,
  ) => number
  readonly onSpawnQuestMonsterWithRetryRings_6FC561E0?: (
    m: D2KernMemory113c,
    pGame: number,
    nX: number,
    nY: number,
    pRoom: number,
    bSetFlag0x03000000: number,
    nMonsterId: number,
  ) => number
}

/**
 * Missile hit handler (`0x6FC5BBB0`): when `pTargetUnit == NULL` and `MISSILE_GetTargetX == 0`,
 * sets `nTargetX = 1`, spawns monster `521` (`0x209`) if Quest `0x24` is active (`0x6FC7C1F0`),
 * and sets the room portal flag (`DUNGEON_ToggleHasPortalFlag113c(pRoom, 1)`).
 *
 * @va D2Game:0x6FC5BBB0
 */
export function MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit = 0,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5BBB0)
  const ebxGame = pGame >>> 0
  const esiMissile = pMissile >>> 0
  if ((pTargetUnit >>> 0) === 0) {
    if (MISSILE_GetTargetX113c(m, esiMissile) === 0) {
      MISSILE_SetTargetX113c(m, esiMissile, 1)
      const ediRoom = UNITS_GetRoom113c(m, esiMissile) >>> 0
      if (QUESTS_CheckNotIntro_6FC53970_113c(m, ebxGame, 0x24) !== 0) {
        if (hooks !== undefined && hooks.onSpawnMonster209NearUnitOffsetMinus5_6FC7C1F0 !== undefined) {
          hooks.onSpawnMonster209NearUnitOffsetMinus5_6FC7C1F0(
            m,
            esiMissile,
            ebxGame,
            ediRoom,
          )
        } else {
          ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c(
            m,
            esiMissile,
            ebxGame,
            ediRoom,
          )
        }
      }
      DUNGEON_ToggleHasPortalFlag113c(m, ediRoom, 1)
    }
  }
  return 0
}

/**
 * Missile server movement handler (`0x6FC5F670`): triggers Quest `0x24` portal/Tyrael spawn (`0x6FC7C1F0`)
 * when `MISSILE_GetTargetX == 0` and `MISSILE_GetRemainingFrames <= 100`, then advances via `0x6FC5F320`.
 *
 * @va D2Game:0x6FC5F670
 */
export function MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5F670)
  const esiGame = pGame >>> 0
  const ebxMissile = pMissile >>> 0
  const ediRemFrames = MISSILE_GetRemainingFrames113c(m, ebxMissile) | 0
  const nTargetX = MISSILE_GetTargetX113c(m, ebxMissile) | 0

  if (nTargetX === 0 && ediRemFrames <= 100) {
    MISSILE_SetTargetX113c(m, ebxMissile, 1)
    const ediRoom = UNITS_GetRoom113c(m, ebxMissile) >>> 0
    if (QUESTS_CheckNotIntro_6FC53970_113c(m, esiGame, 0x24) !== 0) {
      if (hooks !== undefined && hooks.onSpawnMonster209NearUnitOffsetMinus5_6FC7C1F0 !== undefined) {
        hooks.onSpawnMonster209NearUnitOffsetMinus5_6FC7C1F0(
          m,
          ebxMissile,
          esiGame,
          ediRoom,
        )
      } else {
        ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c(
          m,
          ebxMissile,
          esiGame,
          ediRoom,
        )
      }
    }
    DUNGEON_ToggleHasPortalFlag113c(m, ediRoom, 1)
  }

  return MISSILE_SrvDo01_LinearProjectile113c(
    m,
    ebxMissile,
    esiGame,
    hooks !== undefined ? hooks.meleeDot : undefined,
  ) | 0
}

/**
 * Missile server movement handler (`0x6FC5F7D0`): checks owner link and remaining duration
 * (`MISSILE_GetTargetX - pGame->dwGameFrame` in `[10, SKILLS_GetSkillPeriodicDelayOrLength]`),
 * then invokes `0x6FC663A0` and returns `2` (or `1` otherwise).
 *
 * @va D2Game:0x6FC5F7D0
 */
export function MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  nChargeArg: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5F7D0)
  const ecxGame = pGame >>> 0
  const ebxMissile = pMissile >>> 0
  if (ebxMissile === 0) {
    return 1
  }

  const hasOwnerBit = ((m.u32((ebxMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0
  if (!hasOwnerBit) {
    return 1
  }

  const dwOwnerType = m.u32((ebxMissile + 0x94) >>> 0) >>> 0
  const dwOwnerId = m.u32((ebxMissile + 0x98) >>> 0) >>> 0
  const ebpOwner = SUNIT_GetServerUnit113c(m, ecxGame, dwOwnerType, dwOwnerId) >>> 0
  if (ebpOwner === 0 || (nChargeArg | 0) === 0) {
    return 1
  }

  const ediSkillId = MISSILE_GetSkill113c(m, ebxMissile) | 0
  const esiLevel = MISSILE_GetLevel113c(m, ebxMissile) | 0
  const nTargetX = MISSILE_GetTargetX113c(m, ebxMissile) | 0
  const dwGameFrame = m.u32((ecxGame + 0xa8) >>> 0) | 0
  const ebxDuration = (nTargetX - dwGameFrame) | 0

  if (ebxDuration < 10) {
    return 1
  }
  const nMaxLength =
    SKILLS_GetSkillPeriodicDelayOrLength113c(m, ebpOwner, ediSkillId, esiLevel, 1) | 0
  if (ebxDuration > nMaxLength) {
    return 1
  }

  if (hooks !== undefined && hooks.onApplySecondaryAuraAndSpawnChargedMissile_6FC663A0 !== undefined) {
    hooks.onApplySecondaryAuraAndSpawnChargedMissile_6FC663A0(
      m,
      ecxGame,
      ebpOwner,
      ebxDuration,
      ediSkillId,
      esiLevel,
      nChargeArg | 0,
    )
  } else {
    SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(
      m,
      ecxGame,
      ebpOwner,
      ebxDuration,
      ediSkillId,
      esiLevel,
      nChargeArg | 0,
    )
  }
  return 2
}

/**
 * Advances Act 5 Nihlathak / Temple object transformation step (`0x6FC7C480`):
 * step `0 -> 1` transitions the object anim mode to `2`; step `1 -> 2` spawns monster `0x20F` (`527` Pindleskin / Nihlathak),
 * removes the object from its room, transfers preset quest data (`+0x104`), and updates `ACT5Q4_SeqFilter_6FC76B10_113c`.
 *
 * @va D2Game:0x6FC7C480
 */
export function ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC7C480)
  const ebpGame = pGame >>> 0
  const edxQuest = pQuest >>> 0
  const esiData = m.u32((edxQuest + 0x18) >>> 0) >>> 0

  if ((m.u8((esiData + 0x90) >>> 0) & 0xff) !== 0) {
    return 0
  }

  const dwObjUnitId = m.u32((esiData + 0xfc) >>> 0) >>> 0
  if (ebpGame === 0) {
    throw new D2CommonAssertError('pGame != NULL', 723)
  }

  const bucketIdx = (dwObjUnitId & 0x7f) >>> 0
  let ediObj = m.u32((ebpGame + 0x1520 + (bucketIdx << 2)) >>> 0) >>> 0
  while (ediObj !== 0) {
    if ((m.u32((ediObj + 0x0c) >>> 0) >>> 0) === dwObjUnitId) {
      break
    }
    ediObj = m.u32((ediObj + 0xe4) >>> 0) >>> 0
  }

  const nStep = m.u32((esiData + 0x8c) >>> 0) | 0
  if (nStep === 0) {
    if (ediObj !== 0) {
      UNITS_ChangeAnimMode113c(m, ediObj, 2)
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, ediObj)
    }
    m.setU32((esiData + 0x8c) >>> 0, 1)
    return 0
  }

  if (nStep !== 1) {
    return 0
  }

  m.setU32((esiData + 0x8c) >>> 0, 2)
  if (ediObj === 0) {
    return 0
  }

  const pObjRoom = UNITS_GetRoom113c(m, ediObj) >>> 0
  const nX = m.u32((esiData + 0xf0) >>> 0) | 0
  const nY = m.u32((esiData + 0xf4) >>> 0) | 0
  const pSpawnedMon =
    hooks !== undefined && hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0 !== undefined
      ? hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0(
          m,
          ebpGame,
          nX,
          nY,
          pObjRoom,
          1,
          0x20f,
        ) >>> 0
      : QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(
          m,
          ebpGame,
          nX,
          nY,
          pObjRoom,
          1,
          0x20f,
        ) >>> 0
  if (pSpawnedMon === 0) {
    return 0
  }

  const dwType = m.u32(ediObj) | 0
  const dwId = m.u32((ediObj + 0x0c) >>> 0) | 0
  const pRoomNow = UNITS_GetRoom113c(m, ediObj) >>> 0
  DUNGEON_AddRoomPortalNode113c(m, pRoomNow, dwType, dwId)
  UNITROOM_RemoveUnitFromRoom113c(m, ediObj)

  const pPresetNode = m.u32((esiData + 0x104) >>> 0) >>> 0
  if (
    pPresetNode !== 0 &&
    m.u32((pPresetNode + 0x04) >>> 0) !== 0 &&
    (m.u8((esiData + 0x10c) >>> 0) & 0xff) === 0
  ) {
    const ppDst = AIGENERAL_GetQuestDataPtr38_113c(m, pSpawnedMon) >>> 0
    DRLGPRESET_MovePointerAndClear113c(m, (esiData + 0x104) >>> 0, ppDst)
    m.setU8((esiData + 0x10c) >>> 0, 1)
  }

  m.setU32((esiData + 0x98) >>> 0, m.u32((pSpawnedMon + 0x0c) >>> 0) >>> 0)
  m.setU8((esiData + 0x90) >>> 0, 1)
  ACT5Q4_SeqFilter_6FC76B10_113c(
    m,
    edxQuest,
    hooks !== undefined ? hooks.w3b5 : undefined,
  )
  m.setU8((esiData + 0x100) >>> 0, 0)
  return 1
}

/**
 * Spawns monster `0x202` (`514` Nilathak / Frozenstein) for Quest `0x21` (`33`) at the object's
 * coordinates and transfers preset quest data from `pQuestData + 0x108` (`0x6FC7C5C0`).
 *
 * @va D2Game:0x6FC7C5C0
 */
export function ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c(
  m: D2KernMemory113c,
  pOp: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7C5C0)
  const ecxOp = pOp >>> 0
  const pGame = m.u32(ecxOp) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return

  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x21) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }

  const esiData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pObjectUnit = m.u32((ecxOp + 0x04) >>> 0) >>> 0
  const dwObjGuid =
    pObjectUnit !== 0 ? m.u32((pObjectUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32((esiData + 0x110) >>> 0, dwObjGuid)

  if (m.u32((esiData + 0x88) >>> 0) !== 0) return
  if ((m.u8((esiData + 0x93) >>> 0) & 0xff) !== 0) return

  const pRoom = m.u32((ecxOp + 0x08) >>> 0) >>> 0
  const nX = m.u32((ecxOp + 0x14) >>> 0) | 0
  const nY = m.u32((ecxOp + 0x18) >>> 0) | 0
  const pSpawnedMon =
    hooks !== undefined && hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0 !== undefined
      ? hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0(
          m,
          pGame,
          nX,
          nY,
          pRoom,
          1,
          0x202,
        ) >>> 0
      : QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(
          m,
          pGame,
          nX,
          nY,
          pRoom,
          1,
          0x202,
        ) >>> 0
  if (pSpawnedMon === 0) return

  m.setU32((esiData + 0x9c) >>> 0, m.u32((pSpawnedMon + 0x0c) >>> 0) >>> 0)
  m.setU8((esiData + 0x93) >>> 0, 1)

  const pPresetNode = m.u32((esiData + 0x108) >>> 0) >>> 0
  if (
    pPresetNode !== 0 &&
    m.u32((pPresetNode + 0x04) >>> 0) !== 0 &&
    (m.u8((esiData + 0x10d) >>> 0) & 0xff) === 0
  ) {
    const ppDst = AIGENERAL_GetQuestDataPtr38_113c(m, pSpawnedMon) >>> 0
    DRLGPRESET_MovePointerAndClear113c(m, (esiData + 0x108) >>> 0, ppDst)
    m.setU8((esiData + 0x10d) >>> 0, 1)
  }
}

export interface K2W4B3Hooks113c {
  readonly onResetAncientsToStatuesAndAltar_6FC7E0E0?: (
    m: D2KernMemory113c,
    pGame: number,
    pQuest: number,
    pQuestData: number,
  ) => void
}

/**
 * Spawns Frozen Anya (`0x200 = 512`) and her ice prison object (`0xBD = 189`) at the quest object's
 * location when `pQuestData->bObjectRegistered (+0xE1) == 1` (`0x6FC7C690`).
 *
 * @va D2Game:0x6FC7C690
 */
export function ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestData: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7C690)
  const ebpData = pQuestData >>> 0
  if ((m.u8((ebpData + 0xe1) >>> 0) & 0xff) !== 1) {
    return
  }

  const ecxQuest = pQuest >>> 0
  const pGame = m.u32((ecxQuest + 0x04) >>> 0) >>> 0
  const dwObjUnitId = m.u32((ebpData + 0xe4) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('pGame != NULL', 723)
  }

  const bucketIdx = (dwObjUnitId & 0x7f) >>> 0
  let esiObj = m.u32((pGame + 0x1520 + (bucketIdx << 2)) >>> 0) >>> 0
  while (esiObj !== 0) {
    if ((m.u32((esiObj + 0x0c) >>> 0) >>> 0) === dwObjUnitId) {
      break
    }
    esiObj = m.u32((esiObj + 0xe4) >>> 0) >>> 0
  }
  if (esiObj === 0) {
    return
  }

  const ebxRoom = UNITS_GetRoom113c(m, esiObj) >>> 0
  const uType0 = m.u32(esiObj) | 0
  const pPath0 = m.u32((esiObj + 0x2c) >>> 0) >>> 0
  let ediX = 0
  if (uType0 === 2 || (uType0 > 3 && uType0 <= 5)) {
    ediX = pPath0 !== 0 ? m.u32((pPath0 + 0x0c) >>> 0) | 0 : 0
  } else {
    ediX = pPath0 !== 0 ? PATH_GetPosX113c(m, pPath0) | 0 : 0
  }

  const uType1 = m.u32(esiObj) | 0
  const pPath1 = m.u32((esiObj + 0x2c) >>> 0) >>> 0
  let nPosY = 0
  if (uType1 === 2 || (uType1 > 3 && uType1 <= 5)) {
    nPosY = pPath1 !== 0 ? m.u32((pPath1 + 0x10) >>> 0) | 0 : 0
  } else {
    nPosY = pPath1 !== 0 ? PATH_GetPosY113c(m, pPath1) | 0 : 0
  }

  if ((m.u8((ebpData + 0x91) >>> 0) & 0xff) !== 0) {
    return
  }

  const pSpawnedMon =
    hooks !== undefined && hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0 !== undefined
      ? hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0(
          m,
          pGame,
          ediX,
          nPosY,
          ebxRoom,
          1,
          0x200,
        ) >>> 0
      : QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(
          m,
          pGame,
          ediX,
          nPosY,
          ebxRoom,
          1,
          0x200,
        ) >>> 0
  if (pSpawnedMon === 0) {
    return
  }

  m.setU32((ebpData + 0x94) >>> 0, m.u32((pSpawnedMon + 0x0c) >>> 0) >>> 0)
  m.setU8((ebpData + 0x91) >>> 0, 1)
  const ppDst = AIGENERAL_GetQuestDataPtr38_113c(m, pSpawnedMon) >>> 0

  const pPresetNode = m.u32((ebpData + 0x104) >>> 0) >>> 0
  if (
    pPresetNode !== 0 &&
    m.u32((pPresetNode + 0x04) >>> 0) !== 0 &&
    (m.u8((ebpData + 0x10c) >>> 0) & 0xff) === 0
  ) {
    m.setU8((ebpData + 0x10c) >>> 0, 1)
    DRLGPRESET_MovePointerAndClear113c(m, (ebpData + 0x104) >>> 0, ppDst)
  }

  const pCoords = allocStackFrame113c(0x10, m)
  try {
    PATH_GetTargetTypeAndPosition113c(m, pSpawnedMon, pCoords)
    const pMonRoom = UNITS_GetRoom113c(m, pSpawnedMon) >>> 0
    const cX = m.u32(pCoords) | 0
    const cY = m.u32((pCoords + 0x04) >>> 0) | 0
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pMonRoom, cX, cY) >>> 0
    if (pTargetRoom !== 0) {
      const pObj189 =
        SUNIT_AllocUnitData113c(
          m,
          2,
          0xbd,
          cX,
          cY,
          pGame,
          pTargetRoom,
          1,
          1,
          0,
        ) >>> 0
      if (pObj189 !== 0) {
        m.setU8((ebpData + 0xb2) >>> 0, 1)
        m.setU32((ebpData + 0xb4) >>> 0, m.u32((pObj189 + 0x0c) >>> 0) >>> 0)
      }
    }
  } finally {
    freeStackFrame113c(0x10)
  }

  ACT5Q4_SeqFilter_6FC76B10_113c(
    m,
    ecxQuest,
    hooks !== undefined ? hooks.w3b5 : undefined,
  )
}

/**
 * Checks if `pUnit` is on Arreat Summit (`levelId == 0x78`), locates Quest `0x23` (`35` Ancients),
 * and resets the Ancients encounter via `0x6FC7E0E0` when `pQuestData->bCompleted (+0x00) == 0` (`0x6FC7E3C0`).
 *
 * @va D2Game:0x6FC7E3C0
 */
export function ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7E3C0)
  const esiGame = pGame >>> 0
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId !== 0x78) {
    return
  }

  const pQuestControl = m.u32((esiGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x23) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) {
    return
  }

  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if ((m.u8(pQuestData) & 0xff) !== 0) {
    return
  }

  m.setU32((pQuestData + 0x0c) >>> 0, (m.u32((pQuestData + 0x0c) >>> 0) + 1) >>> 0)
  m.setU8((pQuestData + 0x11) >>> 0, 0)
  m.setU8((pQuestData + 0x10) >>> 0, 0)
  if (hooks !== undefined && hooks.onResetAncientsToStatuesAndAltar_6FC7E0E0 !== undefined) {
    hooks.onResetAncientsToStatuesAndAltar_6FC7E0E0(m, esiGame, pQuest, pQuestData)
  } else {
    ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m, esiGame, pQuest, pQuestData)
  }
}

/**
 * Timer/activation handler for an Ancient statue object (`474..476` / `0x1DA..0x1DC`):
 * spawns the corresponding Ancient preset monster via `QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c`
 * (or reschedules event `7` in `+10` frames if blocked) and records its GUID in `pQuestData` (`0x6FC7E420`).
 *
 * @va D2Game:0x6FC7E420
 */
export function ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pObjectUnit: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7E420)
  const ecxQuest = pQuest >>> 0
  const ebpObj = pObjectUnit >>> 0
  const ediData = m.u32((ecxQuest + 0x18) >>> 0) >>> 0

  if (ebpObj !== 0 && (m.u32((ebpObj + 0x10) >>> 0) | 0) === 4) {
    return
  }
  if ((m.u32((ediData + 0x40) >>> 0) | 0) >= 3) {
    return
  }

  const nObjClassId = ebpObj !== 0 ? m.u32((ebpObj + 0x04) >>> 0) | 0 : -1
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const sgptDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0

  let esiPlaceId = 0
  let ebxStatueIdx = 0
  if (nObjClassId === 0x1da) {
    esiPlaceId =
      sgptDataTables !== 0 ? m.u16((sgptDataTables + 0xb3a) >>> 0) & 0xffff : 0
    ebxStatueIdx = 1
  } else if (nObjClassId === 0x1db) {
    esiPlaceId =
      sgptDataTables !== 0 ? m.u16((sgptDataTables + 0xb36) >>> 0) & 0xffff : 0
    ebxStatueIdx = 0
  } else if (nObjClassId === 0x1dc) {
    esiPlaceId =
      sgptDataTables !== 0 ? m.u16((sgptDataTables + 0xb38) >>> 0) & 0xffff : 0
    ebxStatueIdx = 2
  } else {
    return
  }

  const pGame = m.u32((ecxQuest + 0x04) >>> 0) >>> 0
  if ((m.u32((ediData + 0x0c) >>> 0) | 0) > 0) {
    if (hooks !== undefined && hooks.onResetAncientsToStatuesAndAltar_6FC7E0E0 !== undefined) {
      hooks.onResetAncientsToStatuesAndAltar_6FC7E0E0(m, pGame, ecxQuest, ediData)
    } else {
      ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m, pGame, ecxQuest, ediData)
    }
    return
  }

  const pCoords = allocStackFrame113c(0x10, m)
  try {
    PATH_GetTargetTypeAndPosition113c(m, ebpObj, pCoords)
    const esiSpawned =
      QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(
        m,
        esiPlaceId,
        2,
        pCoords,
        pGame,
        ebpObj,
        hooks !== undefined ? hooks.laneK : undefined,
      ) >>> 0

    if (esiSpawned === 0) {
      const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + 10) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGame,
        ebpObj,
        7,
        nextFrame,
        0,
        0,
        0,
        hooks !== undefined ? hooks.eventWheel : undefined,
      )
      return
    }

    if (ebpObj === 0 || (m.u32((ebpObj + 0x10) >>> 0) | 0) !== 4) {
      UNITS_ChangeAnimMode113c(m, ebpObj, 4)
      m.setU32((ediData + 0x30 + (ebxStatueIdx << 2)) >>> 0, 4)
    }

    const curIdx = m.u32((ediData + 0x40) >>> 0) >>> 0
    m.setU8((ediData + 0x2c + curIdx) >>> 0, 1)
    m.setU32(
      (ediData + 0x20 + (curIdx << 2)) >>> 0,
      m.u32((esiSpawned + 0x0c) >>> 0) >>> 0,
    )
    m.setU32((ediData + 0x40) >>> 0, (curIdx + 1) >>> 0)
    m.setU32((ediData + 0x44) >>> 0, (m.u32((ediData + 0x44) >>> 0) + 1) >>> 0)
    m.setU8((ediData + 0x48) >>> 0, 1)
  } finally {
    freeStackFrame113c(0x10)
  }
}

/**
 * Registers the Frozen Anya object (`pOp + 0x04`) into Quest `0x21` (`33`), spawns monster `0x200` (`512`)
 * when `pQuestData + 0x84 == 2`, and schedules timer event `7` via `0x6FC7E7F0` (`0x6FC7EB30`).
 *
 * @va D2Game:0x6FC7EB30
 */
export function ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c(
  m: D2KernMemory113c,
  pOp: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7EB30)
  const ediOp = pOp >>> 0
  const pGame0 = m.u32(ediOp) >>> 0
  const pQuestControl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0

  if (pQuestControl !== 0) {
    let pQuest = m.u32(pQuestControl) >>> 0
    if (pQuest !== 0) {
      while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x21) {
        pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
      }
      if (pQuest === 0) {
        ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(
          m,
          m.u32(ediOp) >>> 0,
          m.u32((ediOp + 0x04) >>> 0) >>> 0,
          hooks !== undefined ? hooks.w2b1 : undefined,
        )
        return
      }

      const esiData = m.u32((pQuest + 0x18) >>> 0) >>> 0
      const pObj = m.u32((ediOp + 0x04) >>> 0) >>> 0
      const dwObjGuid =
        pObj !== 0 ? m.u32((pObj + 0x0c) >>> 0) >>> 0 : 0xffffffff
      m.setU32((esiData + 0xe4) >>> 0, dwObjGuid)
      m.setU8((esiData + 0xe1) >>> 0, 1)
      m.setU32((esiData + 0xe8) >>> 0, m.u32((ediOp + 0x14) >>> 0) >>> 0)
      m.setU32((esiData + 0xec) >>> 0, m.u32((ediOp + 0x18) >>> 0) >>> 0)

      if ((m.u32((esiData + 0x84) >>> 0) | 0) === 2) {
        ACT5Q4_SeqFilter_6FC76B10_113c(
          m,
          pQuest,
          hooks !== undefined ? hooks.w3b5 : undefined,
        )
        if ((m.u8((esiData + 0x91) >>> 0) & 0xff) === 0) {
          const pRoom = m.u32((ediOp + 0x08) >>> 0) >>> 0
          const nX = m.u32((ediOp + 0x14) >>> 0) | 0
          const nY = m.u32((ediOp + 0x18) >>> 0) | 0
          const pSpawnedMon =
            hooks !== undefined && hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0 !== undefined
              ? hooks.onSpawnQuestMonsterWithRetryRings_6FC561E0(
                  m,
                  m.u32(ediOp) >>> 0,
                  nX,
                  nY,
                  pRoom,
                  1,
                  0x200,
                ) >>> 0
              : QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(
                  m,
                  m.u32(ediOp) >>> 0,
                  nX,
                  nY,
                  pRoom,
                  1,
                  0x200,
                ) >>> 0

          if (pSpawnedMon !== 0) {
            m.setU32(
              (esiData + 0x94) >>> 0,
              m.u32((pSpawnedMon + 0x0c) >>> 0) >>> 0,
            )
            m.setU8((esiData + 0x91) >>> 0, 1)
            const pPresetNode = m.u32((esiData + 0x104) >>> 0) >>> 0
            if (
              pPresetNode !== 0 &&
              m.u32((pPresetNode + 0x04) >>> 0) !== 0 &&
              (m.u8((esiData + 0x10c) >>> 0) & 0xff) === 0
            ) {
              const ppDst = AIGENERAL_GetQuestDataPtr38_113c(m, pSpawnedMon) >>> 0
              DRLGPRESET_MovePointerAndClear113c(m, (esiData + 0x104) >>> 0, ppDst)
              m.setU8((esiData + 0x10c) >>> 0, 1)
            }
          }
        }
      }
    }
  }

  ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(
    m,
    m.u32(ediOp) >>> 0,
    m.u32((ediOp + 0x04) >>> 0) >>> 0,
    hooks?.w2b1,
  )
}

/**
 * Sends Act 1 Quest 1 (`nQuestId = 1` Den of Evil) player quest alert packet (`0x5D` via `0x6FC554F0`)
 * when the player's quest flags (`questId = 1`) are in an active/reward-pending state (`0x6FC82D30`).
 *
 * @va D2Game:0x6FC82D30
 */
export function ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC82D30)
  const ebxGame = pGame >>> 0
  const ediPlayer = pPlayerUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ediPlayer) >>> 0
  const nDiff = m.u8((ebxGame + 0x6d) >>> 0) & 0xff
  const esiQuestFlags = m.u32((pPlayerData + 0x10 + (nDiff << 2)) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, esiQuestFlags, 1, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, esiQuestFlags, 1, 0x0f) === 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(
      m,
      1,
      ediPlayer,
      ebxGame,
      hooks?.w3b3,
    )
    return 0
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, esiQuestFlags, 1, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, esiQuestFlags, 1, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(
      m,
      1,
      ediPlayer,
      ebxGame,
      hooks?.w3b3,
    )
  }
  return 0
}

export const ACT1_QUEST_CALLBACK_REFS_W4B3_113C = {
  a1q0Activate: ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c,
  a1q0SetState0: ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c,
  a1q0StatusFilter: ACT1_IntroStatusFilter_6FC80800_113c,
  a1q0NpcAlert: ACT1Q0_CheckWarrivIntroNpcAlert113c,
  a1CainActivate: ACT1_IntroCainActivate_6FC824D0_113c,
  a4IntroCallback08: ACT4_IntroCallback08Noop_6FC80180_113c,
  a4IntroStatusFilter: ACT4_IntroStatusFilter_6FC80170_113c,
  a1q6NpcAlert: ACT1Q6_CheckTravelEastNpcAlert113c,
  a1IntroNpcActivate: ACT1_IntroNpcActivate_6FC82E50_113c,
  a1IntroMarkDone: ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c,
  a4EndgameStatusFilter: ACT4_EndgameStatusFilter_6FC80810_113c,
  a1q2AkaraAlert: ACT1Q2_CheckAkaraIntroNpcAlert113c,
} as const

/**
 * Initializes the Act 1 Quest 0 (`Warriv Intro`) `D2QuestDataStrc` callback table and fields (`0x6FC82D90`).
 *
 * @va D2Game:0x6FC82D90
 */
export function ACT1Q0_InitQuestDescriptor_6FC82D90_113c(
  m: D2KernMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FC82D90)
  const edx = pQuest >>> 0
  const esiCallbacks = (edx + 0xa0) >>> 0
  for (let i = 0; i < 0x0f; i++) {
    m.setU32((esiCallbacks + (i << 2)) >>> 0, 0)
  }

  m.setU32(esiCallbacks, 0x6fc82410)
  m.setU32((edx + 0xcc) >>> 0, 0x6fc82490)
  m.setU32((edx + 0xdc) >>> 0, 0x6fd281c0)
  m.setU8((edx + 0x0a) >>> 0, 1)
  m.setU8((edx + 0x0c) >>> 0, 0)
  m.setU8((edx + 0x0b) >>> 0, 0)
  m.setU32((edx + 0x18) >>> 0, 0)
  m.setU32((edx + 0xe0) >>> 0, 0)
  m.setU32((edx + 0xe8) >>> 0, 0x6fc80800)
  m.setU32((edx + 0xec) >>> 0, 0x6fc807d0)
}

/**
 * Initializes the Act 1 Cain / Travel East (`qstIndex = 0x1D`) `D2QuestDataStrc` callback table and fields (`0x6FC82FA0`).
 *
 * @va D2Game:0x6FC82FA0
 */
export function ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c(
  m: D2KernMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FC82FA0)
  const edx = pQuest >>> 0
  const esiCallbacks = (edx + 0xa0) >>> 0
  for (let i = 0; i < 0x0f; i++) {
    m.setU32((esiCallbacks + (i << 2)) >>> 0, 0)
  }

  m.setU32(esiCallbacks, 0x6fc824d0)
  m.setU32((edx + 0xc0) >>> 0, 0x6fc80180)
  m.setU32((edx + 0xdc) >>> 0, 0x6fd2a510)
  m.setU8((edx + 0x0a) >>> 0, 1)
  m.setU8((edx + 0x0c) >>> 0, 0)
  m.setU8((edx + 0x0b) >>> 0, 0)
  m.setU32((edx + 0xe0) >>> 0, 0x1d)
  m.setU32((edx + 0xe8) >>> 0, 0x6fc80170)
  m.setU32((edx + 0xec) >>> 0, 0x6fc80820)
}

/**
 * Records Act 1 Quest 6 (`Andariel`) completion and GUID lists when a player in Act 1 (`bAct == 0`)
 * does not yet have quest `6` bits `0` or `1` set (`0x6FC83000`).
 *
 * @va D2Game:0x6FC83000
 */
export function ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC83000)
  const ebpGame = pGame >>> 0
  const ebxPlayer = pPlayerUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ebxPlayer) >>> 0
  const nDiff = m.u8((ebpGame + 0x6d) >>> 0) & 0xff
  const esiQuestFlags = m.u32((pPlayerData + 0x10 + (nDiff << 2)) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, esiQuestFlags, 6, 0) === 1) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, esiQuestFlags, 6, 1) === 1) {
    return
  }

  const pRoom = UNITS_GetRoom113c(m, ebxPlayer) >>> 0
  if (pRoom === 0) {
    return
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) {
    return
  }
  const bAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (bAct !== 0) {
    return
  }

  const pQuestControl = m.u32((ebpGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 6) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }

  const ediData = pQuest !== 0 ? m.u32((pQuest + 0x18) >>> 0) >>> 0 : 0
  const dwPlayerGuid =
    ebxPlayer !== 0 ? m.u32((ebxPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff

  QUESTS_GuidListAdd113c(m, ediData, dwPlayerGuid)
  QUESTS_GuidListAdd113c(m, (ediData + 0x84) >>> 0, dwPlayerGuid)
  QUESTS_GuidListAdd113c(m, (ediData + 0x108) >>> 0, dwPlayerGuid)
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(
    m,
    ebxPlayer,
    esiQuestFlags,
    ebpGame,
  )
}

/**
 * Records Act 1 Quest 6 (`Andariel`) completion and GUID lists for a player in Catacombs Level 4
 * (`levelId == 0x25`) when quest `6` bits `0` and `15` (`0x0F`) are both clear (`0x6FC830D0`).
 *
 * @va D2Game:0x6FC830D0
 */
export function ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC830D0)
  const ebpGame = pGame >>> 0
  const ediPlayer = pPlayerUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ediPlayer) >>> 0
  const nDiff = m.u8((ebpGame + 0x6d) >>> 0) & 0xff
  const ebxQuestFlags = m.u32((pPlayerData + 0x10 + (nDiff << 2)) >>> 0) >>> 0

  const esiRoom = UNITS_GetRoom113c(m, ediPlayer) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, ebxQuestFlags, 6, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, ebxQuestFlags, 6, 0x0f) === 1) {
    return 0
  }
  if (esiRoom === 0) {
    return 0
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, esiRoom) | 0
  if (nLevelId !== 0x25) {
    return 0
  }

  const pQuestControl = m.u32((ebpGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 6) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }

  const ebxData = pQuest !== 0 ? m.u32((pQuest + 0x18) >>> 0) >>> 0 : 0
  const dwPlayerGuid =
    ediPlayer !== 0 ? m.u32((ediPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff

  QUESTS_GuidListAdd113c(m, ebxData, dwPlayerGuid)
  QUESTS_GuidListAdd113c(m, (ebxData + 0x84) >>> 0, dwPlayerGuid)
  QUESTS_GuidListAdd113c(m, (ebxData + 0x108) >>> 0, dwPlayerGuid)
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(
    m,
    ediPlayer,
    ebxQuestFlags,
    ebpGame,
  )
  return 0
}

/**
 * Initializes the Act 1 NPC Intro (`Akara`, `qstIndex = 0x2A`) `D2QuestDataStrc` callback table and fields (`0x6FC83CC0`).
 *
 * @va D2Game:0x6FC83CC0
 */
export function ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c(
  m: D2KernMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FC83CC0)
  const edx = pQuest >>> 0
  const esiCallbacks = (edx + 0xa0) >>> 0
  for (let i = 0; i < 0x0f; i++) {
    m.setU32((esiCallbacks + (i << 2)) >>> 0, 0)
  }

  m.setU32(esiCallbacks, 0x6fc82e50)
  m.setU32((edx + 0xcc) >>> 0, 0x6fc82f00)
  m.setU32((edx + 0xdc) >>> 0, 0x6fd27f70)
  m.setU8((edx + 0x0a) >>> 0, 1)
  m.setU8((edx + 0x0c) >>> 0, 0)
  m.setU8((edx + 0x0b) >>> 0, 0)
  m.setU32((edx + 0x18) >>> 0, 0)
  m.setU32((edx + 0xe0) >>> 0, 0x2a)
  m.setU32((edx + 0xe8) >>> 0, 0x6fc80810)
  m.setU32((edx + 0xec) >>> 0, 0x6fc82df0)
}

export interface K2W4B3Hooks113c {
  readonly onDispatchOperateFn?: (
    m: D2KernMemory113c,
    pfnOperateVa: number,
    pOperateArgs: number,
  ) => number
  readonly onSpawnRandomCompactWeaponInRoomAtCoords_6FC31E20?: (
    m: D2KernMemory113c,
    pGame: number,
    pRoom: number,
    pCoords: number,
    nRequiredType: number,
    bSkipRarityRoll: number,
    pOwnerUnit: number,
  ) => number
}

/**
 * Spawns Griswold (`0x109 = 265`) for Act 1 Quest 4 (`Cairn Stones / Tristram`) near `(nX, nY)` in `pRoom`,
 * searching free subtiles via `QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c` with up to `20` diagonal steps
 * and falling back to `MONSTER_SpawnAtCoords113c` (`0x6FC860D0`).
 *
 * @va D2Game:0x6FC860D0
 */
export function ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nX: number,
  nY: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC860D0)
  const eaxGame = pGame >>> 0
  const pQuestControl = m.u32((eaxGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return

  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 4) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }

  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const ediRoom0 = pRoom >>> 0

  const pFrame = allocStackFrame113c(0x60, m)
  try {
    const ppOutRoom = (pFrame + 0x00) >>> 0
    const pIoCoord = (pFrame + 0x08) >>> 0
    const pRoomCoords = (pFrame + 0x10) >>> 0
    const pSpawnArgs = (pFrame + 0x28) >>> 0

    m.setU32(ppOutRoom, ediRoom0)
    DUNGEON_GetRoomCoordinates113c(m, ediRoom0, pRoomCoords)

    const roomX = m.u32(pRoomCoords) | 0
    const roomY = m.u32((pRoomCoords + 0x04) >>> 0) | 0
    const roomW = m.u32((pRoomCoords + 0x08) >>> 0) | 0
    const roomH = m.u32((pRoomCoords + 0x0c) >>> 0) | 0

    let curX = nX | 0
    let curY = nY | 0
    let step = 0
    while (step <= 20) {
      if (
        curX >= roomX &&
        curY >= roomY &&
        curX < ((roomX + roomW - 1) | 0) &&
        curY < ((roomY + roomH - 1) | 0)
      ) {
        break
      }
      curX = (curX + 1) | 0
      curY = (curY + 1) | 0
      step = (step + 1) | 0
    }
    if (step > 20) {
      curX = nY | 0
    }

    m.setU32(pIoCoord, curX >>> 0)
    m.setU32((pIoCoord + 0x04) >>> 0, curY >>> 0)
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
      m,
      ediRoom0,
      pIoCoord,
      2,
      0x100,
      ppOutRoom,
      100,
    )

    let esiRoom = m.u32(ppOutRoom) >>> 0
    let ebxX = 0
    let ediY = 0
    if (esiRoom === 0) {
      esiRoom = ediRoom0
      ebxX = nX | 0
      ediY = nY | 0
    } else {
      ebxX = m.u32(pIoCoord) | 0
      ediY = m.u32((pIoCoord + 0x04) >>> 0) | 0
    }

    m.setU32((pSpawnArgs + 0x00) >>> 0, eaxGame)
    m.setU32((pSpawnArgs + 0x04) >>> 0, esiRoom)
    m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
    m.setU32((pSpawnArgs + 0x0c) >>> 0, 0x109)
    m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
    m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
    m.setU32((pSpawnArgs + 0x18) >>> 0, ebxX >>> 0)
    m.setU32((pSpawnArgs + 0x1c) >>> 0, ediY >>> 0)
    m.setU32((pSpawnArgs + 0x20) >>> 0, 5)
    m.setU16((pSpawnArgs + 0x24) >>> 0, 0)

    let pSpawned = MONSTER_Create113c(m, pSpawnArgs, hooks?.regpop) >>> 0
    if (pSpawned === 0) {
      let attempt = 0
      while (attempt < 20 && pSpawned === 0) {
        ebxX = (ebxX + 1) | 0
        ediY = (ediY + 1) | 0
        m.setU32(pIoCoord, ebxX >>> 0)
        m.setU32((pIoCoord + 0x04) >>> 0, ediY >>> 0)

        let nextRoom = ROOM_FindRoomContainingSubtile113c(m, esiRoom, ebxX, ediY) >>> 0
        if (nextRoom === 0) {
          nextRoom = ediRoom0
          m.setU32(pIoCoord, (nX | 0) >>> 0)
          m.setU32((pIoCoord + 0x04) >>> 0, (nY | 0) >>> 0)
        }
        m.setU32(ppOutRoom, nextRoom)
        QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
          m,
          nextRoom,
          pIoCoord,
          2,
          0x100,
          ppOutRoom,
          100,
        )
        esiRoom = m.u32(ppOutRoom) >>> 0
        if (esiRoom === 0) {
          esiRoom = ediRoom0
          ebxX = nX | 0
          ediY = nY | 0
        } else {
          ebxX = m.u32(pIoCoord) | 0
          ediY = m.u32((pIoCoord + 0x04) >>> 0) | 0
        }
        attempt = (attempt + 1) | 0

        m.setU32((pSpawnArgs + 0x00) >>> 0, eaxGame)
        m.setU32((pSpawnArgs + 0x04) >>> 0, esiRoom)
        m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
        m.setU32((pSpawnArgs + 0x0c) >>> 0, 0x109)
        m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
        m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
        m.setU32((pSpawnArgs + 0x18) >>> 0, ebxX >>> 0)
        m.setU32((pSpawnArgs + 0x1c) >>> 0, ediY >>> 0)
        m.setU32((pSpawnArgs + 0x20) >>> 0, 10)
        m.setU16((pSpawnArgs + 0x24) >>> 0, 0)
        pSpawned = MONSTER_Create113c(m, pSpawnArgs, hooks?.regpop) >>> 0
      }

      if (pSpawned === 0) {
        pSpawned =
          MONSTER_SpawnAtCoords113c(
            m,
            0x109,
            1,
            eaxGame,
            ediRoom0,
            nX | 0,
            nY | 0,
            0x0f,
            0,
            hooks?.regpop,
          ) >>> 0
      }
    }

    if (pSpawned !== 0) {
      m.setU32(
        (pSpawned + 0xc4) >>> 0,
        (m.u32((pSpawned + 0xc4) >>> 0) | 0x03000000) >>> 0,
      )
      m.setU8((pQuestData + 0x51) >>> 0, 1)
      m.setU8((pQuestData + 0x52) >>> 0, 0)
      m.setU32((pQuestData + 0x68) >>> 0, m.u32((pSpawned + 0x0c) >>> 0) >>> 0)
    }
  } finally {
    freeStackFrame113c(0x60)
  }
}

/**
 * Computes a shrine stat bonus delta from `nBonusPct` (`ebx`) and `nStatId` (`[esp+4]`) on `pPlayerUnit` (`esi`):
 * returns `nBonusPct` directly for percentage/resist stats (`11, 27, 39, 41, 43, 45, 85, 171`),
 * scales attack rating (`19`) via `SKILLS_CalcUnitSkillToHit_6FC89B00_113c`, and scales min damage (`21`/`23`) or other stats by `/ 100`.
 *
 * @va D2Game:0x6FC89EE0
 */
export function OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  nBonusPct: number,
  nStatId: number,
): number {
  hitD2GameVa113c(0x6FC89EE0)
  const esiPlayer = pPlayerUnit >>> 0
  const ebxPct = nBonusPct | 0
  const ebpStatId = nStatId | 0

  let ediCompositWeapon = 0
  if (esiPlayer !== 0) {
    const pInventory = m.u32((esiPlayer + 0x60) >>> 0) >>> 0
    if (pInventory !== 0) {
      ediCompositWeapon = INVENTORY_GetCompositWeaponMemPort113c(m, pInventory) >>> 0
    }
  }

  switch (ebpStatId) {
    case 11:
    case 27:
    case 39:
    case 41:
    case 43:
    case 45:
    case 85:
    case 171:
      return ebxPct

    case 19: {
      const pSkill = SKILLS_GetSkillById113c(m, esiPlayer, 0, -1) >>> 0
      const pOutToHit = allocStackFrame113c(0x10, m)
      try {
        m.setU32(pOutToHit, 0)
        SKILLS_CalcUnitSkillToHit_6FC89B00_113c(
          m,
          ediCompositWeapon,
          pSkill,
          esiPlayer,
          pOutToHit,
          1,
        )
        const nToHit = m.u32(pOutToHit) | 0
        return sdiv32(imul32(nToHit, ebxPct), 100)
      } finally {
        freeStackFrame113c(0x10)
      }
    }

    case 21: {
      const pActiveWeapon = ITEMS_GetActiveWeaponForAttack113c(m, esiPlayer, 1) >>> 0
      let statToQuery = 0x15
      if (pActiveWeapon !== 0 || ediCompositWeapon !== 0) {
        const pInventory = m.u32((esiPlayer + 0x60) >>> 0) >>> 0
        const nHandClass =
          INVENTORY_GetEquippedWeaponHandClass113c(m, esiPlayer, pInventory) | 0
        if (nHandClass === 2) {
          statToQuery = 0x17
        }
      }
      const baseStat = STATLIST_GetUnitStat113c(m, esiPlayer, statToQuery, 0) | 0
      return sdiv32(imul32(baseStat, ebxPct), 100)
    }

    default: {
      const baseStat = STATLIST_GetUnitStat113c(m, esiPlayer, ebpStatId, 0) | 0
      return sdiv32(imul32(baseStat, ebxPct), 100)
    }
  }
}

/**
 * Spawns `1` or `2` monsters around `pObjectUnit` using `pGame->pObjectControl (+0x10F0)` LCG seed,
 * resolving the base classId via `OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c` (`0x6FC8A4E0`).
 *
 * @va D2Game:0x6FC8A4E0
 */
export function OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObjectUnit: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC8A4E0)
  const ediGame = pGame >>> 0
  const esiObj = pObjectUnit >>> 0
  UNITS_GetRoom113c(m, esiObj)

  const ecxObjControl = m.u32((ediGame + 0x10f0) >>> 0) >>> 0
  const lo = BigInt(m.u32(ecxObjControl) >>> 0)
  const hi = BigInt(m.u32((ecxObjControl + 0x04) >>> 0) >>> 0)
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(ecxObjControl, newLo)
  m.setU32((ecxObjControl + 0x04) >>> 0, newHi)

  const esiCount = ((newLo & 1) + 1) | 0
  const pOpArgs = allocStackFrame113c(0x20, m)
  try {
    m.setU32((pOpArgs + 0x00) >>> 0, ediGame)
    m.setU32((pOpArgs + 0x04) >>> 0, esiObj)
    m.setU32((pOpArgs + 0x08) >>> 0, 0)
    m.setU32((pOpArgs + 0x0c) >>> 0, ecxObjControl)

    const ebxMonId =
      OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, pOpArgs) | 0
    if (ebxMonId < 0) {
      return
    }

    const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
    const sgptDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    const nMonStatsCount =
      sgptDataTables !== 0 ? m.u32((sgptDataTables + 0xa80) >>> 0) | 0 : 0
    if (ebxMonId >= nMonStatsCount || esiCount <= 0) {
      return
    }

    for (let i = 0; i < esiCount; i++) {
      OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(
        m,
        ebxMonId,
        pOpArgs,
        8,
        hooks?.regpop,
      )
    }
  } finally {
    freeStackFrame113c(0x20)
  }
}

/**
 * Validates that `pPlayerUnit` (or monster with `Objects.txt +0x16D != 0`) is within object interaction
 * range (`UNITS_IsUnitInObjRectRange113c`), then dispatches `OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c`.
 *
 * @va D2Game:0x6FC8A720
 */
export function OBJ_TryOperateObjectIfInRange_6FC8A720_113c(
  m: D2KernMemory113c,
  wUnitType: number,
  pPlayerUnit: number,
  pGame: number,
  dwObjectId: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8A720)
  const ebxType = wUnitType & 0xffff
  const ediUnit = pPlayerUnit >>> 0
  const ecxGame = pGame >>> 0
  const ebpObjId = dwObjectId >>> 0

  const esiObj = SUNIT_GetServerUnit113c(m, ecxGame, ebxType, ebpObjId) >>> 0
  if (esiObj === 0) {
    return 0
  }

  if (ediUnit !== 0) {
    const nObjClassId = m.u32((esiObj + 0x04) >>> 0) | 0
    if ((m.u32(ediUnit) | 0) === 1) {
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId) >>> 0
      if (pObjTxt === 0 || (m.u8((pObjTxt + 0x16d) >>> 0) & 0xff) === 0) {
        return 1
      }
    }
    if (UNITS_IsUnitInObjRectRange113c(m, ediUnit, esiObj) === 0) {
      return 1
    }
  }

  const pOutFlag = allocStackFrame113c(0x10, m)
  try {
    m.setU32(pOutFlag, 1)
    OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(
      m,
      pOutFlag,
      ebpObjId,
      ecxGame,
      ediUnit,
      ebxType,
      hooks?.onDispatchOperateFn,
    )
    return m.u32(pOutFlag) | 0
  } finally {
    freeStackFrame113c(0x10)
  }
}

/**
 * Object `OperateFn 20` (Weapon Rack): when `pObject->dwAnimMode == 0`, spawns a random weapon
 * via `0x6FC31E20`, sets `dwAnimMode = 2`, and clears `UNITFLAG_TARGETABLE (0x02)` (`0x6FC8B280`).
 *
 * @va D2Game:0x6FC8B280
 */
export function OBJ_OperateFn20_WeaponRack_6FC8B280_113c(
  m: D2KernMemory113c,
  pOp: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B280)
  const ediOp = pOp >>> 0
  const pObject0 = m.u32((ediOp + 0x04) >>> 0) >>> 0

  if (pObject0 === 0 || m.u32((pObject0 + 0x10) >>> 0) === 0) {
    const pCoords = allocStackFrame113c(0x10, m)
    try {
      PATH_GetTargetTypeAndPosition113c(m, pObject0, pCoords)
      const pObject1 = m.u32((ediOp + 0x04) >>> 0) >>> 0
      const pRoom = UNITS_GetRoom113c(m, pObject1) >>> 0
      const pGame = m.u32(ediOp) >>> 0
      if (
        hooks !== undefined &&
        hooks.onSpawnRandomCompactWeaponInRoomAtCoords_6FC31E20 !== undefined
      ) {
        hooks.onSpawnRandomCompactWeaponInRoomAtCoords_6FC31E20(
          m,
          pGame,
          pRoom,
          pCoords,
          -1,
          0,
          0,
        )
      } else {
        ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(
          m,
          pGame,
          pRoom,
          pCoords,
          -1,
          0,
          0,
        )
      }
      const pObject2 = m.u32((ediOp + 0x04) >>> 0) >>> 0
      UNITS_ChangeAnimMode113c(m, pObject2, 2)
      const pObject3 = m.u32((ediOp + 0x04) >>> 0) >>> 0
      if (pObject3 !== 0) {
        m.setU32(
          (pObject3 + 0xc4) >>> 0,
          (m.u32((pObject3 + 0xc4) >>> 0) & 0xfffffffd) >>> 0,
        )
      }
    } finally {
      freeStackFrame113c(0x10)
    }
  }
  return 1
}


export interface K2W4B3Hooks113c {
  readonly onSpawnRandomArmorInRoomAtCoords_6FC31FB0?: (
    m: D2KernMemory113c,
    pCoords: number,
    pRoom: number,
    pGame: number,
    nIlvlOverride: number,
    nQuality: number,
    bDropAtCoords: number,
  ) => number
}

/**
 * Object `OperateFn 19` (Armor Stand): when `pObject->dwAnimMode == 0`, spawns a random armor
 * via `0x6FC31FB0`, sets `dwAnimMode = 2`, and clears `UNITFLAG_TARGETABLE (0x02)` (`0x6FC8B2E0`).
 *
 * @va D2Game:0x6FC8B2E0
 */
export function OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c(
  m: D2KernMemory113c,
  pOp: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B2E0)
  const esiOp = pOp >>> 0
  const pObject0 = m.u32((esiOp + 0x04) >>> 0) >>> 0

  if (pObject0 === 0 || m.u32((pObject0 + 0x10) >>> 0) === 0) {
    const pCoords = allocStackFrame113c(0x10, m)
    try {
      PATH_GetTargetTypeAndPosition113c(m, pObject0, pCoords)
      const pObject1 = m.u32((esiOp + 0x04) >>> 0) >>> 0
      const pRoom = UNITS_GetRoom113c(m, pObject1) >>> 0
      const pGame = m.u32(esiOp) >>> 0
      if (
        hooks !== undefined &&
        hooks.onSpawnRandomArmorInRoomAtCoords_6FC31FB0 !== undefined
      ) {
        hooks.onSpawnRandomArmorInRoomAtCoords_6FC31FB0(
          m,
          pCoords,
          pRoom,
          pGame,
          -1,
          0,
          0,
        )
      } else {
        ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(
          m,
          pCoords,
          pRoom,
          pGame,
          -1,
          0,
          0,
        )
      }
      const pObject2 = m.u32((esiOp + 0x04) >>> 0) >>> 0
      UNITS_ChangeAnimMode113c(m, pObject2, 2)
      const pObject3 = m.u32((esiOp + 0x04) >>> 0) >>> 0
      if (pObject3 !== 0) {
        m.setU32(
          (pObject3 + 0xc4) >>> 0,
          (m.u32((pObject3 + 0xc4) >>> 0) & 0xfffffffd) >>> 0,
        )
      }
    } finally {
      freeStackFrame113c(0x10)
    }
  }
  return 1
}

/**
 * Constructs a `D2ObjOperateStrc` on the stack for `pObjectUnit`, resolves its interacting
 * player from `UNITS_GetField7C_113c(pObjectUnit)->dwOwnerId` in `pGame->pUnitList[0]`, and
 * drops chest treasure via `OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c` (`0x6FC8B6F0`).
 *
 * @va D2Game:0x6FC8B6F0
 */
export function OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObjectUnit: number,
): number {
  hitD2GameVa113c(0x6FC8B6F0)
  const ediGame = pGame >>> 0
  const esiObj = pObjectUnit >>> 0
  UNITS_GetRoom113c(m, esiObj)
  const pObjControl = m.u32((ediGame + 0x10f0) >>> 0) >>> 0

  const pField7C = UNITS_GetField7C_113c(m, esiObj) >>> 0
  const dwPlayerId =
    pField7C !== 0 ? m.u32((pField7C + 0x04) >>> 0) >>> 0 : 0xffffffff

  const bucketIdx = (dwPlayerId & 0x7f) >>> 0
  let pPlayer = m.u32((ediGame + 0x1120 + (bucketIdx << 2)) >>> 0) >>> 0
  while (pPlayer !== 0) {
    if ((m.u32((pPlayer + 0x0c) >>> 0) >>> 0) === dwPlayerId) {
      break
    }
    pPlayer = m.u32((pPlayer + 0xe4) >>> 0) >>> 0
  }

  const pOpArgs = allocStackFrame113c(0x20, m)
  try {
    m.setU32((pOpArgs + 0x00) >>> 0, ediGame)
    m.setU32((pOpArgs + 0x04) >>> 0, esiObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)
    m.setU32((pOpArgs + 0x0c) >>> 0, pObjControl)
    return OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOpArgs, 0) | 0
  } finally {
    freeStackFrame113c(0x20)
  }
}

/**
 * Spawns monster `0x171` (`369` Evil Hut / Trapped Soul) from `pObject` via `OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c`.
 *
 * @va D2Game:0x6FC8B860
 */
export function OBJ_SpawnMonster369FromObject_6FC8B860_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B860)
  return (
    OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(
      m,
      pObject >>> 0,
      pGame >>> 0,
      0x171,
      hooks?.regpop,
    ) | 0
  )
}

/**
 * Spawns monster `0x149` (`329` Trapped Soul 2) from `pObject` via `OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c`.
 *
 * @va D2Game:0x6FC8B870
 */
export function OBJ_SpawnMonster329FromObject_6FC8B870_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B870)
  return (
    OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(
      m,
      pObject >>> 0,
      pGame >>> 0,
      0x149,
      hooks?.regpop,
    ) | 0
  )
}

/**
 * Spawns monster `0x146` (`326` Clay Golem / Trap Monster) from `pObject` via `OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c`.
 *
 * @va D2Game:0x6FC8B880
 */
export function OBJ_SpawnMonster326FromObject_6FC8B880_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B880)
  return (
    OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(
      m,
      pObject >>> 0,
      pGame >>> 0,
      0x146,
      hooks?.regpop,
    ) | 0
  )
}


export interface K2W4B3Hooks113c {
  readonly onGetTickCount?: (m: D2KernMemory113c) => number
}

/**
 * Spawns monster `0x14A` (`330` Blood Golem / Trap Monster) from `pObject` via `OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c`.
 *
 * @va D2Game:0x6FC8B890
 */
export function OBJ_SpawnMonster330FromObject_6FC8B890_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B890)
  return (
    OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(
      m,
      pObject >>> 0,
      pGame >>> 0,
      0x14a,
      hooks?.regpop,
    ) | 0
  )
}

/**
 * Object `OperateFn 48` (Trapped Soul): rolls `pObjectControl` LCG `% 100`; if `< 90`, drops chest treasure
 * via `OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c` and sets anim mode `5`, otherwise sets anim mode `1`
 * and schedules timer events `1` and `9` (`0x6FC8CE10`).
 *
 * @va D2Game:0x6FC8CE10
 */
export function OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c(
  m: D2KernMemory113c,
  pOp: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8CE10)
  const esiOp = pOp >>> 0
  const pObject0 = m.u32((esiOp + 0x04) >>> 0) >>> 0
  if (pObject0 !== 0 && m.u32((pObject0 + 0x10) >>> 0) !== 0) {
    return 0
  }

  const nObjClassId = pObject0 !== 0 ? m.u32((pObject0 + 0x04) >>> 0) | 0 : -1
  const ediObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId) >>> 0
  const ecxSeed = m.u32((esiOp + 0x0c) >>> 0) >>> 0
  const lo = BigInt(m.u32(ecxSeed) >>> 0)
  const hi = BigInt(m.u32((ecxSeed + 0x04) >>> 0) >>> 0)
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((ecxSeed + 0x04) >>> 0, newHi)
  m.setU32(ecxSeed, newLo)

  const rem = (newLo >>> 0) % 100
  if (rem < 0x5a) {
    if (OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, esiOp, 0) !== 0) {
      const pObject1 = m.u32((esiOp + 0x04) >>> 0) >>> 0
      UNITS_ChangeAnimMode113c(m, pObject1, 5)
    }
    return 0
  }

  const pObject2 = m.u32((esiOp + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject2, 1)
  const pGame1 = m.u32(esiOp) >>> 0
  const dwFrameCnt1 = ediObjTxt !== 0 ? m.u32((ediObjTxt + 0xdc) >>> 0) >>> 8 : 0
  const dwFrame1 = (dwFrameCnt1 + m.u32((pGame1 + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGame1,
    m.u32((esiOp + 0x04) >>> 0) >>> 0,
    1,
    dwFrame1,
    0,
    0,
    0,
    hooks?.eventWheel,
  )

  const pGame2 = m.u32(esiOp) >>> 0
  const dwFrame9 = (m.u32((pGame2 + 0xa8) >>> 0) + 0x14) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGame2,
    m.u32((esiOp + 0x04) >>> 0) >>> 0,
    9,
    dwFrame9,
    0,
    0,
    0,
    hooks?.eventWheel,
  )
  return 0
}

/**
 * Object `OperateFn 28` (Urn / Breakable Container): triggers player Kick skill (`1`), sets object anim mode `1`,
 * clears targetable flag, rolls monster trap (`% 10000 >= 8192`) and chest drop (`% 100 <= 20`), and schedules event `1` (`0x6FC8D7B0`).
 *
 * @va D2Game:0x6FC8D7B0
 */
export function OBJ_OperateFn28_Urn_6FC8D7B0_113c(
  m: D2KernMemory113c,
  pOp: number,
  hooks?: K2W4B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8D7B0)
  const esiOp = pOp >>> 0
  const pObject0 = m.u32((esiOp + 0x04) >>> 0) >>> 0
  if (pObject0 !== 0 && m.u32((pObject0 + 0x10) >>> 0) !== 0) {
    return 0
  }

  const pRoom = UNITS_GetRoom113c(m, pObject0) >>> 0
  DUNGEON_GetLevelIdFromRoom113c(m, pRoom)

  const pPlayer = m.u32((esiOp + 0x08) >>> 0) >>> 0
  if (pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0) {
    const ediKickSkill = SKILLS_GetSkillById113c(m, pPlayer, 1, -1) >>> 0
    if (ediKickSkill !== 0) {
      const pObjTarget = m.u32((esiOp + 0x04) >>> 0) >>> 0
      const pPlr = m.u32((esiOp + 0x08) >>> 0) >>> 0
      UNITS_SetTargetUnitForDynamicUnit113c(m, pPlr, pObjTarget)
      const nKickMode = SKILLS_GetLeftSkillFromSkillList113c(m, ediKickSkill) | 0
      PLAYER_StartModeOnUnit113c(
        m,
        m.u32(esiOp) >>> 0,
        pPlr,
        pObjTarget,
        nKickMode,
        0,
        0,
        0,
        ediKickSkill,
      )
    }
  }

  const pObject1 = m.u32((esiOp + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject1, 1)
  const pObject2 = m.u32((esiOp + 0x04) >>> 0) >>> 0
  if (pObject2 !== 0) {
    m.setU32((pObject2 + 0xc4) >>> 0, (m.u32((pObject2 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }
  UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((esiOp + 0x04) >>> 0) >>> 0)

  const ecxSeed1 = m.u32((esiOp + 0x0c) >>> 0) >>> 0
  const prod1 = BigInt(m.u32(ecxSeed1) >>> 0) * 0x6ac690c5n + BigInt(m.u32((ecxSeed1 + 0x04) >>> 0) >>> 0)
  const lo1 = Number(prod1 & 0xffffffffn) >>> 0
  m.setU32((ecxSeed1 + 0x04) >>> 0, Number((prod1 >> 32n) & 0xffffffffn) >>> 0)
  m.setU32(ecxSeed1, lo1)
  if (((lo1 % 0x2710) & 0xffffe000) !== 0) {
    const nMonId = OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, esiOp) | 0
    OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(m, nMonId, esiOp, 8, hooks?.regpop)
  }

  const ecxSeed2 = m.u32((esiOp + 0x0c) >>> 0) >>> 0
  const prod2 = BigInt(m.u32(ecxSeed2) >>> 0) * 0x6ac690c5n + BigInt(m.u32((ecxSeed2 + 0x04) >>> 0) >>> 0)
  const lo2 = Number(prod2 & 0xffffffffn) >>> 0
  m.setU32((ecxSeed2 + 0x04) >>> 0, Number((prod2 >> 32n) & 0xffffffffn) >>> 0)
  m.setU32(ecxSeed2, lo2)
  if (lo2 % 100 <= 0x14) {
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, esiOp, 0)
  }

  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((esiOp + 0x10) >>> 0) | 0) >>> 0
  const dwFrameCnt = pObjTxt !== 0 ? m.u32((pObjTxt + 0xdc) >>> 0) >>> 8 : 0
  const pGame = m.u32(esiOp) >>> 0
  const dwFrame = (dwFrameCnt + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGame,
    m.u32((esiOp + 0x04) >>> 0) >>> 0,
    1,
    dwFrame,
    0,
    0,
    0,
    hooks?.eventWheel,
  )
  return 0
}

/**
 * Validates all 7 Horadric Cube recipe input slots (`0..6`) against `pInventory` via
 * `CUBE_ValidateRecipeInputSlot_6FC90240_113c` (`0x6FC90CF0`).
 *
 * @va D2Game:0x6FC90CF0
 */
export function CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(
  m: D2KernMemory113c,
  pCubeMainTxt: number,
  pInventory: number,
  pGame: number,
  pCubeOutputCtx: number,
): number {
  hitD2GameVa113c(0x6FC90CF0)
  const esiCubeMainTxt = pCubeMainTxt >>> 0
  const ebxInv = pInventory >>> 0
  if (ebxInv === 0 || esiCubeMainTxt === 0) {
    return 0
  }

  const pUsedItemFlags = allocStackFrame113c(0xc0, m)
  try {
    for (let i = 0; i < 0x30; i++) {
      m.setU32((pUsedItemFlags + (i << 2)) >>> 0, 0)
    }
    for (let ediSlot = 0; ediSlot < 7; ediSlot++) {
      const ok = CUBE_ValidateRecipeInputSlot_6FC90240_113c(
        m,
        esiCubeMainTxt,
        pGame >>> 0,
        ebxInv,
        ediSlot,
        pCubeOutputCtx >>> 0,
        pUsedItemFlags,
      )
      if (ok === 0) {
        return 0
      }
    }
    return 1
  } finally {
    freeStackFrame113c(0xc0)
  }
}

/**
 * Attempts to initiate a player-to-player trade session between `pPlayer1` (`eax`) and `pPlayer2` (`edi`)
 * in `pGame` (`[esp+4]`), checking busy states, cooldowns, and town presence (`0x6FC90D90`).
 *
 * @va D2Game:0x6FC90D90
 */
export function PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c(
  m: D2KernMemory113c,
  pPlayer1: number,
  pPlayer2: number,
  pGame: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC90D90)
  const esi = pPlayer1 >>> 0
  const edi = pPlayer2 >>> 0
  if (esi !== 0 && (m.u32(esi) | 0) === 0) {
    if (m.u8((esi + 0x6c) >>> 0) !== 0) return
    if (INVENTORY_GetCursorItem113c(m, m.u32((esi + 0x60) >>> 0)) !== 0) return
    const pPlrData1Init = UNITS_GetPlayerData113c(m, esi) >>> 0
    if (m.u32((pPlrData1Init + 0x4c) >>> 0) !== 0) return
  }

  if (ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame >>> 0) !== 0) {
    return
  }

  const ebpTick = hooks?.onGetTickCount ? hooks.onGetTickCount(m) >>> 0 : 0
  const pPlrData2 = UNITS_GetPlayerData113c(m, edi) >>> 0
  const ebxPlrData1 = UNITS_GetPlayerData113c(m, esi) >>> 0

  if (edi !== 0 && (m.u32(edi) | 0) === 0) {
    const bBusy2 =
      m.u8((edi + 0x6c) >>> 0) !== 0 ||
      INVENTORY_GetCursorItem113c(m, m.u32((edi + 0x60) >>> 0)) !== 0 ||
      m.u32((UNITS_GetPlayerData113c(m, edi) + 0x4c) >>> 0) !== 0
    if (bBusy2) {
      if (((ebpTick - m.u32((ebxPlrData1 + 0x54) >>> 0)) >>> 0) <= 0x3e8) return
      NET_SendEventMessagePacket5A_6FC90BF0_113c(m, pPlrData2, 8, esi)
      m.setU32((ebxPlrData1 + 0x54) >>> 0, ebpTick)
      return
    }
  }

  if (((ebpTick - m.u32((pPlrData2 + 0x58) >>> 0)) >>> 0) < 0x1388) {
    if (((m.u32((ebxPlrData1 + 0x54) >>> 0) + 0x3e8) >>> 0) >= ebpTick) return
    m.setU32((ebxPlrData1 + 0x54) >>> 0, ebpTick)
    NET_SendEventMessagePacket5A_6FC90BF0_113c(m, pPlrData2, 9, esi)
    return
  }

  if (m.u32((ebxPlrData1 + 0x50) >>> 0) !== 0 || m.u32((pPlrData2 + 0x50) >>> 0) !== 0) {
    return
  }

  if (((ebpTick - m.u32((ebxPlrData1 + 0x58) >>> 0)) >>> 0) < 0x1388) {
    if (ebpTick <= ((m.u32((ebxPlrData1 + 0x54) >>> 0) + 0x3e8) >>> 0)) return
    NET_SendEventMessagePacket5A_6FC90BF0_113c(m, 0, 9, esi)
    m.setU32((ebxPlrData1 + 0x54) >>> 0, ebpTick)
    return
  }

  const bTown1 =
    DUNGEON_IsTownLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, esi))) !== 0
  const bTown2 =
    bTown1 &&
    DUNGEON_IsTownLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, edi))) !== 0
  if (!bTown1 || !bTown2) {
    m.setU32((esi + 0x64) >>> 0, 0xffffffff)
    m.setU32((esi + 0x68) >>> 0, 6)
    m.setU8((esi + 0x6c) >>> 0, 0)
    m.setU32((edi + 0x64) >>> 0, 0xffffffff)
    m.setU32((edi + 0x68) >>> 0, 6)
    m.setU8((edi + 0x6c) >>> 0, 0)
    return
  }

  const dwId2 = edi !== 0 ? m.u32((edi + 0x0c) >>> 0) >>> 0 : 0xffffffff
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, esi, 0, dwId2)
  const dwId1 = esi !== 0 ? m.u32((esi + 0x0c) >>> 0) >>> 0 : 0xffffffff
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, edi, 0, dwId1)

  const pClient1 =
    esi !== 0 && (m.u32(esi) | 0) === 0
      ? m.u32((UNITS_GetPlayerData113c(m, esi) + 0x9c) >>> 0) >>> 0
      : 0
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0, pClient1)

  const pClient2 =
    edi !== 0 && (m.u32(edi) | 0) === 0
      ? m.u32((UNITS_GetPlayerData113c(m, edi) + 0x9c) >>> 0) >>> 0
      : 0
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 1, pClient2)

  m.setU32((ebxPlrData1 + 0x50) >>> 0, 1)
  m.setU32((pPlrData2 + 0x50) >>> 0, 2)
}
