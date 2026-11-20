/**
 * Diablo II v1.13c 1:1 `D2Game.dll` Monster Drop -> TreasureClass -> Item Creation ->
 * Quality -> Magic/Rare/Set/Unique/Superior/LowQ Affixes -> Ethereal/Sockets ->
 * Item Stats -> Ground Drop Spiral -> Ground Expiration -> Durability Loss Pipeline
 * operating directly on `Memory113c` (`SparseMemory113c`).
 *
 * Every `@va`-annotated routine executes genuine `D2Game.dll` + `D2Common.dll` logic
 * against `Memory113c` structs (`D2GameStrc`, `D2UnitStrc`, `D2ItemDataStrc`,
 * `D2ItemDropStrc`, `D2StatListStrc`, `D2StaticPathStrc`, `D2ActiveRoomStrc`) with
 * zero shortcuts, zero JS array sorting, zero nullish operators, and zero I/O.
 */

import {
  COLLISION_CheckSubtileMask113c,
  COLLISION_FindFreePositionBasic113c,
} from '../common/collision.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { SEED_GetLowSeed113c } from '../common/drlg/drlg-grid.ts'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_GetRoomExFromRoom113c,
} from '../common/dungeon.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../common/inline-helpers.ts'
import { imul32, sar32, sdiv32 } from '../common/int-math.ts'
import {
  INVENTORY_GetItemEquipLocation113c,
  ITEMS_SetItemFormat113c,
} from '../common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_ApplyEtherealBonusStats113c,
  ITEMS_ApplyItemQualityMods113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetBitField2FromItem113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetComponentByte113c,
  ITEMS_GetGambleCostFromItem113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetItemTypeNormal113c,
  ITEMS_GetItemTypeShootsFromItem113c,
  ITEMS_GetMaxSocketsFromItemType113c,
  ITEMS_GetMissileWeaponVelocity113c,
  ITEMS_GetOwnerGuid113c,
  ITEMS_GetStaffModsClass113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_GetVarInvGfxCount113c,
  ITEMS_IsHighQualityItem113c,
  ITEMS_IsMagicQualityAllowed113c,
  ITEMS_IsNormalQualityAllowed113c,
  ITEMS_IsRareQualityAllowed113c,
  ITEMS_IsTome113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_SetAutoAffix113c,
  ITEMS_SetEarLevel113c,
  ITEMS_SetEarName113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemLevel113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOwnerGuid113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
  ITEMS_SetVarGfxIndex113c,
  ITEMS_TestFlagMask113c,
} from '../common/items.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_GetTargetTypeAndPosition113c } from '../common/path.ts'
import {
  SKILLS_GetClassSkillCount113c,
  SKILLS_GetClassSkillId113c,
} from '../common/skills.ts'
import {
  ITEMS_SetItemCell113c,
  STATES_CheckStateMask30OnUnit113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetOwnerId113c,
  STATLIST_GetOwnerType113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetStatListFromUnitStateOrFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_RollRandomItemGraphicStat113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c } from '../prng.ts'
import {
  DATATBLS_GetItemRatioTxtRecord113c,
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetMagicAffixTxtRecord113c,
  ITEMS_CheckIfUnique113c,
} from '../tables/datatbls-113c.ts'
import {
  DATATBLS_GetItemDataTables113c,
  DATATBLS_GetItemIdFromItemCode113c,
} from '../tables/item-tbls-113c.ts'
import {
  DATATBLS_GetSuperUniquesTxtRecord113c,
  DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c,
} from '../tables/monster-tbls-113c.ts'
import {
  MONSTER_GetSuperUniqueId113c,
  PARTY_CountLivingPartyMembersInSameLevel113c,
  S2C_SendPacket9C_ItemActionWorld113c,
  UNITROOM_BroadcastGroundItemIfUpdated113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  MONSTER_CheckTypeFlagsMask113c,
} from './ai-fallen-113c.ts'
import { D2GAME_SUNIT_IterateAllLivingPlayers113c } from './boot-init-gap-b-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  ITEMS_GetUnitAndLeaderMagicFind113c,
  ITEMS_RollInitialDurabilityStat113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  SEED_RollRangeWithMinFast113c,
} from './k2-gap-melee-dot-113c.ts'
import { ITEMS_FindSuperiorQualityRecordIndex113c } from './k2-items-tc-w1-113c.ts'
import {
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  STATLIST_SetUnitStatGoldGuarded_6FC21040_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  ITEMS_CalcDiminishingMfPercent_6FC2E130_113c,
  ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c,
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  ITEMS_InitBaseWeaponDamageStats_6FC2E860_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c,
  OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c,
  ITEMS_AddStaffModSkillsByTier_6FC335E0_113c,
  ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c,
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
} from './k2-w3b1-113c.ts'
import { QUESTS_AttachUnitToQuest_6FC55890_113c } from './k2-w3b3-113c.ts'
import {
  ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c,
  ITEMS_ApplySetItemModsByFormat_6FC341E0_113c,
  ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c,
  ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c,
  ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c,
  ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c,
  ITEMS_RollMagicAffixByFormat_6FC34B50_113c,
  ITEMS_RollRareNameIdByFormat_6FC34B30_113c,
  ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c,
  ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c,
} from './k2-w4b1-113c.ts'
import {
  ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c,
  ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c,
  ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c,
  ITEMS_RollRareAffixesByFormat_6FC354F0_113c,
  type K2W4B3Hooks113c,
} from './k2-w4b3-113c.ts'
import {
  ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c,
  type K2W4B4Hooks113c,
} from './k2-w4b4-113c.ts'
import { ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c } from './k2-w5b7-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  GAME_GetEffectivePlayerCount113c,
  MONSTATS_GetRecordPtr113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_AllocUnitData113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/**
 * Scratch arena in `D2Game.dll` `.bss` (`0x6FD3E400..0x6FD3F3FF`, 4 KiB) used for
 * stack-allocated `D2ItemDropStrc` (`0x84`B), `D2CoordStrc` (`8`B), and `0x9C` packet buffers
 * so recursive / nested item creation never aliases caller frames or advances heap bump pointers.
 */
const ITEMDROP_STACK_BASE_VA_113C = 0x6fd3e400
const ITEMDROP_STACK_LIMIT_VA_113C = 0x6fd3f400
let itemDropStackCursor113c = ITEMDROP_STACK_BASE_VA_113C

function pushItemDropStack113c(m: Memory113c, bytes: number): number {
  const aligned = ((bytes + 7) & ~7) >>> 0
  if (((itemDropStackCursor113c + aligned) >>> 0) <= ITEMDROP_STACK_LIMIT_VA_113C) {
    const ptr = itemDropStackCursor113c >>> 0
    itemDropStackCursor113c = (ptr + aligned) >>> 0
    m.fill(ptr, aligned, 0)
    return ptr
  }
  const heapPtr = m.alloc(aligned) >>> 0
  m.fill(heapPtr, aligned, 0)
  return heapPtr
}

function popItemDropStack113c(savedPtr: number): void {
  if (
    (savedPtr >>> 0) >= ITEMDROP_STACK_BASE_VA_113C &&
    (savedPtr >>> 0) <= ITEMDROP_STACK_LIMIT_VA_113C
  ) {
    itemDropStackCursor113c = savedPtr >>> 0
  }
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64At113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

/** `0x6FC21180` (`SEED_RollLimitedRandomNumber`, `ecx = pSeed`, `eax = nMax`). */
function rollLimitedRandomNumber_6FC21180_113c(
  m: Memory113c,
  pSeed: number,
  nMax: number,
): number {
  const maxS = nMax | 0
  if (maxS <= 0) return 0
  const newLo = stepSeed64At113c(m, pSeed)
  const maxU = maxS >>> 0
  if ((maxU & ((maxU - 1) >>> 0)) === 0) {
    return (newLo & ((maxU - 1) >>> 0)) | 0
  }
  return ((newLo >>> 0) % maxU) | 0
}

function safeReadU32_113c(m: Memory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0) >>> 0
  } catch {
    return 0
  }
}

export function isSgptDataTablesLoaded113c(m: Memory113c): boolean {
  const sgpt = safeReadU32_113c(m, D2COMMON_SGPT_DATATABLES_VA_113C)
  const nItems = safeReadU32_113c(m, 0x6fdefb94)
  const pItems = safeReadU32_113c(m, 0x6fdefb98)
  if (sgpt !== 0 && nItems > 0 && pItems !== 0) {
    const iatPtr = safeReadU32_113c(m, D2GAME_IAT_SGPT_DATATABLES_VA_113C)
    if (iatPtr === 0) {
      m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, D2COMMON_SGPT_DATATABLES_VA_113C)
    }
    return true
  }
  return false
}

export function isItemRatioTableLoaded113c(m: Memory113c): boolean {
  return safeReadU32_113c(m, 0x6fdefd88) > 0 && safeReadU32_113c(m, 0x6fdefd84) !== 0
}

export function isAffixTablesLoaded113c(m: Memory113c): boolean {
  return (
    isSgptDataTablesLoaded113c(m) &&
    safeReadU32_113c(m, 0x6fdefbd8) !== 0 &&
    safeReadU32_113c(m, 0x6fdefbe8) !== 0 &&
    safeReadU32_113c(m, 0x6fdefbf8) !== 0
  )
}

export interface RealItemDropHooks113c {
  /**
   * Optional S2C `0x9C` world item action callback (`0x6FCF4550 -> 0x6FCF40F0 -> 0x6FCAD3D0`).
   * Receives each newly created ground item unit pointer and its serialized `0x9C` packet bytes.
   */
  readonly onWorldItemAction9C?: (pItem: number, packet9C: Uint8Array) => void
}

let activeRealItemDropHooks113c: RealItemDropHooks113c | undefined

/**
 * Serializes a newly dropped ground `UNIT_ITEM` into the exact S2C `0x9C` (`ACT_ADD_TO_GROUND` = `0x00`
 * when `ITEMCMD_NEWITEM` `0x10` is set, `0x02` when `UNITFLAG_DROPPED` `0x1000` is set, else `0x03`)
 * packet format produced by `D2Game:0x6FCAD3D0` + `D2Common.#10987` (`ITEMS_SerializeItemToBuffer`).
 *
 * @va D2Game:0x6FCAD3D0 (311B)
 */
export function buildGroundItemPacket9C_6FCAD3D0_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  bActionOverride = -1,
): Uint8Array {
  if (pItem === 0) return new Uint8Array(0)
  const savedSp = itemDropStackCursor113c
  const pktBuf = pushItemDropStack113c(m, 0x100)
  try {
    const dwFlags = m.u32((pItem + 0xc4) >>> 0) >>> 0
    const cmdFlags = ITEMS_GetCommandFlags113c(m, pItem) >>> 0
    let bAction = bActionOverride
    if (bAction < 0) {
      if ((dwFlags & 0x1000) !== 0) {
        bAction = 2
      } else if ((cmdFlags & 0x10) !== 0) {
        bAction = 0
      } else {
        bAction = 3
      }
    }

    // Default ground item byte[3] is 0x10 (unequipped world item location)
    let categoryByte = 0x10
    if (pGame !== 0) {
      const pClient = safeReadU32_113c(m, (pGame + 0x88) >>> 0)
      if (pClient !== 0 && safeReadU32_113c(m, (pClient + 0x14) >>> 0) !== 0) {
        const pPlr = safeReadU32_113c(m, (pClient + 0x174) >>> 0)
        if (pPlr !== 0) {
          const eqLoc = INVENTORY_GetItemEquipLocation113c(m, pPlr, pItem) & 0xff
          if (eqLoc !== 0) {
            categoryByte = eqLoc
          }
        }
        S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pItem, bAction, 0, 0)
        UNITROOM_BroadcastGroundItemIfUpdated113c(m, pItem, pClient)
      }
    }

    m.setU8(pktBuf, 0x9c)
    m.setU8((pktBuf + 1) >>> 0, bAction & 0xff)
    m.setU8((pktBuf + 3) >>> 0, categoryByte & 0xff)
    m.setU32((pktBuf + 4) >>> 0, m.u32((pItem + 0x0c) >>> 0) >>> 0)

    const nSerialized =
      ITEMS_SerializeItemToBuffer113c(m, pItem, (pktBuf + 8) >>> 0, 0xf4, 0, 0, 0) | 0
    if (nSerialized <= 0) {
      return new Uint8Array(0)
    }
    const pktLen = (nSerialized + 8) & 0xff
    m.setU8((pktBuf + 2) >>> 0, pktLen)
    const out = new Uint8Array(pktLen)
    for (let i = 0; i < pktLen; i++) {
      out[i] = m.u8((pktBuf + i) >>> 0)
    }
    return out
  } finally {
    popItemDropStack113c(savedSp)
  }
}

/**
 * Resolves the item drop level (`ilvl`) for `pDropper` (`0x6FC2E5D0..0x6FC2E650`, `129B`):
 * - `UNIT_MONSTER (1)` -> `STATLIST_GetUnitStat(pDropper, 12, 0)`
 * - `UNIT_PLAYER (0)` -> `STATLIST_GetUnitBaseStat(pDropper, 12, 0)`
 * - Other unit types -> `DATATBLS_GetLevelMonsterLevel(levelId, nDifficulty, bExpansion)`
 * Clamps `< 1` to `1`.
 *
 * @va D2Game:0x6FC2E5D0 (129B)
 */
export function ITEMS_GetDropItemLevel_6FC2E5D0_113c(
  m: Memory113c,
  pGame: number,
  pDropper: number,
  _bUnused = 0,
): number {
  hitD2GameVa113c(0x6FC2E5D0)
  const unit = pDropper >>> 0
  const game = pGame >>> 0
  let ilvl = 1
  if (unit !== 0) {
    const uType = m.u32(unit) >>> 0
    if (uType === 1) {
      ilvl = STATLIST_GetUnitStat113c(m, unit, 12, 0) | 0
    } else if (uType === 0) {
      ilvl = STATLIST_GetUnitBaseStat113c(m, unit, 12, 0) | 0
    } else if (game !== 0 && isSgptDataTablesLoaded113c(m)) {
      const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
      if (pRoom !== 0) {
        const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
        const diff = m.u8((game + 0x6d) >>> 0)
        const bExp = m.u32((game + 0x70) >>> 0)
        ilvl = DATATBLS_GetLevelMonsterLevel113c(m, levelId, diff, bExp) | 0
      }
    }
  }
  if (ilvl < 1) {
    ilvl = 1
  }
  return ilvl
}

/**
 * Probes `(centerX + 2, centerY + 3)` via `ROOM_FindRoomContainingSubtile` (`0x6FC21280`),
 * pre-fills `pOutCoords` with `(centerX + 2, centerY + 3)` if in-room else `(centerX, centerY)`,
 * and runs `COLLISION_FindFreePositionBasic` (`D2Common.#10654`, `wMask = 0x3E01`, `wFieldMask = 0x801`).
 *
 * @va D2Game:0x6FC2E930 (85B)
 */
export function ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(
  m: Memory113c,
  pRoom: number,
  pCenterCoords: number,
  pOutCoords: number,
  nUnitSize = 1,
): number {
  hitD2GameVa113c(0x6FC2E930)
  const room = pRoom >>> 0
  const center = pCenterCoords >>> 0
  const out = pOutCoords >>> 0
  if (room === 0 || center === 0 || out === 0) return 0

  const cx = m.u32(center) | 0
  const cy = m.u32((center + 4) >>> 0) | 0
  const prefX = (cx + 2) | 0
  const prefY = (cy + 3) | 0

  if (ROOM_FindRoomContainingSubtile113c(m, room, prefX, prefY) !== 0) {
    m.setU32(out, prefX >>> 0)
    m.setU32((out + 4) >>> 0, prefY >>> 0)
  } else {
    m.setU32(out, cx >>> 0)
    m.setU32((out + 4) >>> 0, cy >>> 0)
  }

  return (
    COLLISION_FindFreePositionBasic113c(
      m,
      room,
      out,
      center,
      nUnitSize | 0,
      0x3e01,
      0x801,
      1,
    ) >>> 0
  )
}

/**
 * Schedules `Event 3` (`STAT_ITEM_REPLENISH_QUANTITY` = `0xFD`, `253`) on `pItem` at
 * `dwGameFrame + sdiv32(2500, rate) + 1` if no pending `Event 3` exists.
 *
 * @va D2Game:0x6FC2EA10 (81B)
 */
export function ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FC2EA10)
  if (pGame === 0 || pItem === 0) return
  const rate = STATLIST_GetUnitStat113c(m, pItem, 0xfd, 0) | 0
  if (rate === 0) return
  if (EVENT_GetNextEventFrame113c(m, pItem, 3) !== 0) return
  const frame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  const target = (frame + (sdiv32(0x9c4, rate) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, pItem, 3, target, 0, 0, 0)
}

/**
 * Schedules `Event 3` (`STAT_ITEM_REPLENISH_DURABILITY` = `0xFC`, `252`) on `pItem` at
 * `dwGameFrame + sdiv32(2500, rate) + 1` if no pending `Event 3` exists.
 *
 * @va D2Game:0x6FC2EA70 (81B)
 */
export function ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FC2EA70)
  if (pGame === 0 || pItem === 0) return
  const rate = STATLIST_GetUnitStat113c(m, pItem, 0xfc, 0) | 0
  if (rate === 0) return
  if (EVENT_GetNextEventFrame113c(m, pItem, 3) !== 0) return
  const frame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  const target = (frame + (sdiv32(0x9c4, rate) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, pItem, 3, target, 0, 0, 0)
}

/**
 * Rolls 5% Ethereal (`SEED_RollLimitedRandomNumber(pItemSeed, 100) < 5` or forced via `pDrop+0x44 & 0x400000`
 * or `pDrop+0x80 & 4`) on eligible weapons (`0x2D`) and armor (`0x32`), applying `+50%` base defense /
 * weapon damage (`D2Common.#10890`) and setting `maxDur = (baseMaxDur / 2) + 1`, `dur = maxDur`.
 *
 * @va D2Game:0x6FC2EBB0 (211B)
 */
export function ITEMS_RollAndApplyEthereal_6FC2EBB0_113c(
  m: Memory113c,
  pItem: number,
  pItemDrop: number,
): void {
  hitD2GameVa113c(0x6FC2EBB0)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  if (item === 0 || drop === 0) return
  if ((m.u8((drop + 0x80) >>> 0) & 0x02) !== 0) return
  if (
    ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x2d) === 0 &&
    ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x32) === 0
  ) {
    return
  }
  if (ITEMS_CanItemLoseDurability113c(m, item) === 0) return
  const qual = ITEMS_GetItemQuality113c(m, item) | 0
  if (qual === 1 || qual === 5) return
  if (ITEMS_GetComponentByte113c(m, item) !== 0) return

  const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
  const roll = rollLimitedRandomNumber_6FC21180_113c(m, pSeed, 100)
  let bEthereal = roll < 5 ? 1 : 0
  if ((m.u32((drop + 0x44) >>> 0) & 0x400000) !== 0) {
    bEthereal = 1
  }
  if ((m.u8((drop + 0x80) >>> 0) & 0x04) === 0 && bEthereal === 0) {
    return
  }

  ITEMS_ApplyEtherealBonusStats113c(m, item)
  if (ITEMS_CanItemLoseDurability113c(m, item) !== 0) {
    const baseMaxDur = STATLIST_GetUnitBaseStat113c(m, item, 0x49, 0) | 0
    const nextMaxDur = (sdiv32(baseMaxDur, 2) + 1) | 0
    STATLIST_SetUnitStat113c(m, item, 0x49, nextMaxDur, 0)
    const curMaxDur = STATLIST_GetUnitStat113c(m, item, 0x49, 0) | 0
    STATLIST_SetUnitStat113c(m, item, 0x48, curMaxDur, 0)
  }
}

/**
 * Rolls 33% Sockets (`SEED_RollLimitedRandomNumber(pItemSeed, 100) < 33`, clamped to `3`/`4`/`6`
 * by `pGame->nDifficulty` and `ItemTypes.txt` ilvl caps) and assigns `STAT_ITEM_NUMSOCKETS (194)`
 * via `D2Common.#10992` (`ITEMS_GetMissileWeaponVelocity113c`).
 *
 * @va D2Game:0x6FC2EC90 (299B)
 */
export function ITEMS_RollAndApplySockets_6FC2EC90_113c(
  m: Memory113c,
  pItem: number,
  pItemDrop: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC2EC90)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  const game = pGame >>> 0
  if (item === 0 || drop === 0 || game === 0) return

  if ((ITEMS_GetItemQuality113c(m, item) | 0) < 2) return
  if (ITEMS_GetSubTypeFromItem113c(m, item) === 0) return
  if (ITEMS_GetTwoHandedFlag113c(m, item) !== 0) return
  if ((ITEMS_GetMaxSocketsFromItemType113c(m, item) & 0xff) === 0) return

  let maxSock = ITEMS_GetMaxSocketsFromItemType113c(m, item) & 0xff
  const diff = m.u8((game + 0x6d) >>> 0)
  if (diff === 0) {
    if (maxSock >= 3) maxSock = 3
  } else if (diff === 1) {
    if (maxSock >= 4) maxSock = 4
  } else if (diff === 2) {
    if (maxSock >= 6) maxSock = 6
  }
  if (maxSock <= 0) return

  const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
  if (wFormat < 100) {
    if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 3) !== 0) return
  }

  const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
  let roll = rollLimitedRandomNumber_6FC21180_113c(m, pSeed, 100)
  const dwFlags2 = m.u32((drop + 0x80) >>> 0) >>> 0
  if ((dwFlags2 & 0x08) !== 0) return
  if ((dwFlags2 & 0x10) !== 0) roll = 0
  if ((m.u32((drop + 0x44) >>> 0) & 0x800) === 0 && roll >= 33) return

  ITEMS_SetOrClearCommandFlags113c(m, item, 0x800, 1)
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1) {
    const ownerGuid = ITEMS_GetOwnerGuid113c(m, item) >>> 0
    const nSockets = ((ownerGuid % (maxSock >>> 0)) + 1) | 0
    ITEMS_GetMissileWeaponVelocity113c(m, item, nSockets)
  } else {
    if (maxSock > 3) maxSock = 3
    if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x25) !== 0 && maxSock > 2) {
      maxSock = 2
    }
    ITEMS_GetMissileWeaponVelocity113c(m, item, maxSock)
  }
}

/** `0x6FD1D09C` quality probe order `[7, 6, 5, 4, 3, 2]` in `0x6FC2EE90`. */
const CREATED_ITEM_QUALITY_ORDER_6FD1D09C: readonly number[] = [7, 6, 5, 4, 3, 2]

/**
 * Rolls (or returns `pItemDrop->nQuality` when `wItemFormat >= 1 && nQuality != 0`) the item quality
 * on `ITEMS_GetItemSeed(pItem)` against `ItemRatio.txt` (`0x6FC2EE90..0x6FC2F14D`, `702B`).
 *
 * @va D2Game:0x6FC2EE90 (702B)
 */
export function ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(
  m: Memory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC2EE90)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  if (item === 0) return 2
  const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
  if (wFormat >= 1 && drop !== 0) {
    const forcedQual = m.u32((drop + 0x30) >>> 0) | 0
    if (forcedQual !== 0) {
      return forcedQual
    }
  }
  if (!isSgptDataTablesLoaded113c(m) || !isItemRatioTableLoaded113c(m)) {
    return drop !== 0 && m.u32((drop + 0x30) >>> 0) !== 0 ? m.u32((drop + 0x30) >>> 0) | 0 : 2
  }
  const pGame = m.u32((item + 0x80) >>> 0) >>> 0
  const diff = pGame !== 0 ? m.u8((pGame + 0x6d) >>> 0) : 0
  const nItemId = m.u32((item + 0x04) >>> 0) | 0
  const versionArg = wFormat >= 1 ? 100 : 0
  const pRatio = DATATBLS_GetItemRatioTxtRecord113c(m, nItemId, diff, versionArg) >>> 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pRatio === 0 || pItemsTxt === 0) {
    return 2
  }
  if (m.u8((pItemsTxt + 0x12a) >>> 0) !== 0) {
    return 2
  }

  let lvlDiff = drop !== 0 ? m.u32((drop + 0x0c) >>> 0) | 0 : 1
  if (wFormat >= 1) {
    if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x34) !== 0) {
      lvlDiff = 1
    } else {
      lvlDiff = (lvlDiff - m.u8((pItemsTxt + 0xfd) >>> 0)) | 0
      if (lvlDiff < 1) lvlDiff = 1
    }
  }

  if (wFormat >= 1) {
    for (let i = 0; i < 6; i++) {
      const q = CREATED_ITEM_QUALITY_ORDER_6FD1D09C[i]!
      let base = 0
      let div = 1
      if (q === 7) {
        base = m.u32(pRatio) | 0
        div = m.u32((pRatio + 0x04) >>> 0) | 0
      } else if (q === 6) {
        base = m.u32((pRatio + 0x0c) >>> 0) | 0
        div = m.u32((pRatio + 0x10) >>> 0) | 0
      } else if (q === 5) {
        base = m.u32((pRatio + 0x18) >>> 0) | 0
        div = m.u32((pRatio + 0x1c) >>> 0) | 0
      } else if (q === 4) {
        base = m.u32((pRatio + 0x24) >>> 0) | 0
        div = m.u32((pRatio + 0x28) >>> 0) | 0
      } else if (q === 3) {
        base = m.u32((pRatio + 0x30) >>> 0) | 0
        div = m.u32((pRatio + 0x34) >>> 0) | 0
      } else {
        base = m.u32((pRatio + 0x38) >>> 0) | 0
        div = m.u32((pRatio + 0x3c) >>> 0) | 0
      }
      const thresh = div !== 0 ? (base - sdiv32(lvlDiff, div)) | 0 : base
      if (thresh <= 0) {
        return q
      }
      const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
      if (SEED_RollLimitedFast113c(m, pSeed, thresh) === 0) {
        return q
      }
    }
    return 1
  }

  // Classic format == 0 loop (`0x6FC2F084..0x6FC2F140`)
  for (let i = 0; i < 6; i++) {
    const q = CREATED_ITEM_QUALITY_ORDER_6FD1D09C[i]!
    let base = 0
    let div = 1
    if (q === 7) {
      base = m.u32(pRatio) | 0
      div = m.u32((pRatio + 0x04) >>> 0) | 0
    } else if (q === 6) {
      base = m.u32((pRatio + 0x0c) >>> 0) | 0
      div = m.u32((pRatio + 0x10) >>> 0) | 0
    } else if (q === 5) {
      base = m.u32((pRatio + 0x18) >>> 0) | 0
      div = m.u32((pRatio + 0x1c) >>> 0) | 0
    } else if (q === 4) {
      base = m.u32((pRatio + 0x24) >>> 0) | 0
      div = m.u32((pRatio + 0x28) >>> 0) | 0
    } else if (q === 3) {
      base = m.u32((pRatio + 0x30) >>> 0) | 0
      div = m.u32((pRatio + 0x34) >>> 0) | 0
    } else {
      base = m.u32((pRatio + 0x38) >>> 0) | 0
      div = m.u32((pRatio + 0x3c) >>> 0) | 0
    }
    const thresh = div !== 0 ? ((base * 2 - sdiv32(lvlDiff, div)) | 0) : base * 2
    if (thresh <= 0) {
      return q
    }
    const pSeed = ITEMS_GetItemSeed113c(m, item) >>> 0
    if ((SEED_RollLimitedFast113c(m, pSeed, thresh) | 0) <= 1) {
      return q
    }
  }
  return 1
}

/**
 * Scales gold drop `STAT_GOLD (14)` by `(100 + killerGoldBonus + leaderGoldBonus) / 100`
 * (`STAT_ITEM_GOLDBONUS` = `79`, `0x4F`).
 *
 * @va D2Game:0x6FC2F260 (138B)
 */
export function ITEMS_ApplyGoldFindBonus_6FC2F260_113c(
  m: Memory113c,
  pItem: number,
  pKiller: number,
): void {
  hitD2GameVa113c(0x6FC2F260)
  const item = pItem >>> 0
  const killer = pKiller >>> 0
  if (item === 0 || killer === 0) return
  if ((ITEMS_GetItemTypeFromItem113c(m, item) | 0) !== 4) return

  let pLeader = AIGENERAL_GetPackLeaderUnit113c(m, killer) >>> 0
  if (pLeader === killer) {
    pLeader = 0
  }
  const leaderGf = pLeader !== 0 ? STATLIST_GetUnitStatWithLayer113c(m, pLeader, 0x4f, 0) | 0 : 0
  const killerGf = STATLIST_GetUnitStatWithLayer113c(m, killer, 0x4f, 0) | 0
  const totalPct = (100 + leaderGf + killerGf) | 0
  const curGold = STATLIST_GetUnitStat113c(m, item, 0x0e, 0) | 0
  let scaled = sdiv32(imul32(curGold, totalPct), 100)
  if (scaled < 0) {
    scaled = 0
  } else if (m.u32(item) === 0) {
    const limit = STATLIST_GetUnitGoldBankLimit113c(m, item) | 0
    if (scaled > limit) {
      scaled = 0
    }
  }
  STATLIST_SetUnitStat113c(m, item, 0x0e, scaled, 0)
}

/**
 * Walks all active rooms in `pAct` (`pGame->pAct[nAct]` when `nActOrPAct < 5`, else `nActOrPAct` pointer)
 * and frees ground `UNIT_ITEM` (`dwUnitType == 4`) units whose `pItemData->dwActionStamp (+0x24)`
 * is non-zero and `<= pGame->dwGameFrame (+0xA8)`.
 *
 * @va D2Game:0x6FC2FB70 (194B)
 */
export function ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c(
  m: Memory113c,
  pGame: number,
  nActOrPAct: number,
): void {
  hitD2GameVa113c(0x6FC2FB70)
  const game = pGame >>> 0
  if (game === 0) return
  const arg = nActOrPAct >>> 0
  const pAct = arg < 5 ? m.u32((game + arg * 4 + 0xbc) >>> 0) >>> 0 : arg
  if (pAct === 0) return

  const dwGameFrame = m.u32((game + 0xa8) >>> 0) | 0
  // D2Common.#10717 (`DUNGEON_GetFirstRoomFromAct` -> `[pAct + 0x10]`)
  let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
  while (pRoom !== 0) {
    let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
    while (pUnit !== 0) {
      const pNextUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
      if (m.u32(pUnit) === 4) {
        const pItemData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        const expireFrame = pItemData !== 0 ? m.u32((pItemData + 0x24) >>> 0) | 0 : 0
        if (expireFrame !== 0 && expireFrame <= dwGameFrame) {
          const pItemRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
          if (pItemRoom !== 0) {
            DUNGEON_AddRoomPortalNode113c(
              m,
              pItemRoom,
              m.u32(pUnit) >>> 0,
              m.u32((pUnit + 0x0c) >>> 0) >>> 0,
            )
            UNITS_SetTargetUnitForDynamicUnitEx113c(m, pUnit)
            UNITROOM_RemoveUnitFromRoom113c(m, pUnit)
          }
          m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & ~2) >>> 0)
          D2GAME_SUNIT_IterateAllLivingPlayers113c(m, game, (mem, _g, pPlayer) => {
            const pPlrData = UNITS_GetPlayerData113c(mem, pPlayer) >>> 0
            if (pPlrData !== 0) {
              // 0x6FC2E7E0: clear player target reference if pointing at expired ground item
              const pPath = mem.u32((pPlayer + 0x2c) >>> 0) >>> 0
              if (pPath !== 0 && (mem.u32((pPath + 0x58) >>> 0) >>> 0) === pUnit) {
                mem.setU32((pPath + 0x58) >>> 0, 0)
              }
            }
          }, 0)
          SUNIT_FreeUnit113c(m, game, pUnit)
        }
      }
      pUnit = pNextUnit
    }
    pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
  }
}

/**
 * Rolls dropped item quality (`1..7`) for `nItemId` at `nItemLevel` using `ItemTypes.txt`,
 * `ItemRatio.txt`, `ITEMS_GetUnitAndLeaderMagicFind113c` (`0x6FC2F2F0`), diminishing MF (`0x6FC2E130`),
 * and the 6-word TC quality factor array (`pTcFactors`: `[Magic, Rare, Set, Unique, Eth, Sock]`).
 *
 * @va D2Game:0x6FC2FC40 (893B)
 */
export function ITEMS_RollItemQuality_6FC2FC40_113c(
  m: Memory113c,
  pGame: number,
  pDropper: number,
  pKiller: number,
  nItemId: number,
  nItemLevel: number,
  pTcFactors = 0,
  pSeedOverride = 0,
): number {
  hitD2GameVa113c(0x6FC2FC40)
  const game = pGame >>> 0
  const dropper = pDropper >>> 0
  if (!isSgptDataTablesLoaded113c(m) || !isItemRatioTableLoaded113c(m)) {
    return 2
  }
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) return 0

  const itemType = ITEMS_IsTome113c(m, nItemId) | 0
  if (itemType < 0) return 0
  const pSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (pSgpt === 0 || itemType >= (m.u32((pSgpt + 0xbfc) >>> 0) | 0)) return 0
  const pItemTypesTxt = (m.u32((pSgpt + 0xbf8) >>> 0) + imul32(itemType, 0xe4)) >>> 0
  if (pItemTypesTxt === 0) return 0

  if (m.u8((pItemTypesTxt + 0x16) >>> 0) !== 0) return 2
  if (m.u8((pItemsTxt + 0x129) >>> 0) !== 0) return 7
  if (m.u8((pItemTypesTxt + 0x14) >>> 0) !== 0 && m.u8((pItemsTxt + 0x12a) >>> 0) !== 0) {
    return 7
  }

  const diff = game !== 0 ? m.u8((game + 0x6d) >>> 0) : 0
  const bExp = game !== 0 ? m.u32((game + 0x70) >>> 0) : 1
  const versionArg = bExp !== 0 ? 100 : 0
  const pRatio = DATATBLS_GetItemRatioTxtRecord113c(m, nItemId, diff, versionArg) >>> 0
  if (pRatio === 0) return 2

  const pSeed =
    pSeedOverride !== 0 ? pSeedOverride >>> 0 : dropper !== 0 ? (dropper + 0x20) >>> 0 : 0
  if (pSeed === 0) return 2

  const baseQlvl = m.u8((pItemsTxt + 0xfd) >>> 0)
  const lvlDiff = (nItemLevel - baseQlvl) | 0
  const mfBonus = pKiller !== 0 ? ITEMS_GetUnitAndLeaderMagicFind113c(m, pKiller) | 0 : 0

  const fMagic = pTcFactors !== 0 ? sx16(m.u16(pTcFactors >>> 0)) : 0
  const fRare = pTcFactors !== 0 ? sx16(m.u16((pTcFactors + 2) >>> 0)) : 0
  const fSet = pTcFactors !== 0 ? sx16(m.u16((pTcFactors + 4) >>> 0)) : 0
  const fUnique = pTcFactors !== 0 ? sx16(m.u16((pTcFactors + 6) >>> 0)) : 0

  if (mfBonus === 0 || mfBonus > -100) {
    const hasMf = mfBonus !== 0 ? 1 : 0
    const totalMf = (mfBonus + 100) | 0

    // 1. Unique (7)
    {
      let chance =
        (((m.u32(pRatio) | 0) - sdiv32(lvlDiff, m.u32((pRatio + 0x04) >>> 0) | 0)) << 7) | 0
      if (hasMf !== 0) {
        const effMf = ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, totalMf, 250, 250) | 0
        if (effMf !== 0) chance = sdiv32(imul32(chance, 100), effMf)
      }
      const minChance = m.u32((pRatio + 0x08) >>> 0) | 0
      if (chance <= minChance) chance = minChance
      chance = (chance - sdiv32(imul32(fUnique, chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 7
      }
    }

    // 2. Set (5)
    {
      let chance =
        (((m.u32((pRatio + 0x18) >>> 0) | 0) -
          sdiv32(lvlDiff, m.u32((pRatio + 0x1c) >>> 0) | 0)) <<
          7) |
        0
      if (hasMf !== 0) {
        const effMf = ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, totalMf, 500, 500) | 0
        if (effMf !== 0) chance = sdiv32(imul32(chance, 100), effMf)
      }
      const minChance = m.u32((pRatio + 0x20) >>> 0) | 0
      if (chance <= minChance) chance = minChance
      chance = (chance - sdiv32(imul32(fSet, chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 5
      }
    }

    // 3. Rare (6) if ItemTypes.bRare (+0x15) != 0
    if (m.u8((pItemTypesTxt + 0x15) >>> 0) !== 0) {
      let chance =
        (((m.u32((pRatio + 0x0c) >>> 0) | 0) -
          sdiv32(lvlDiff, m.u32((pRatio + 0x10) >>> 0) | 0)) <<
          7) |
        0
      if (hasMf !== 0) {
        const effMf = ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, totalMf, 600, 600) | 0
        if (effMf !== 0) chance = sdiv32(imul32(chance, 100), effMf)
      }
      const minChance = m.u32((pRatio + 0x14) >>> 0) | 0
      if (chance <= minChance) chance = minChance
      chance = (chance - sdiv32(imul32(fRare, chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 6
      }
    }

    // 4. Magic (4)
    if (m.u8((pItemTypesTxt + 0x14) >>> 0) !== 0) {
      return 4
    }
    {
      let chance =
        (((m.u32((pRatio + 0x24) >>> 0) | 0) -
          sdiv32(lvlDiff, m.u32((pRatio + 0x28) >>> 0) | 0)) <<
          7) |
        0
      if (hasMf !== 0 && totalMf !== 0) {
        chance = sdiv32(imul32(chance, 100), totalMf)
      }
      const minChance = m.u32((pRatio + 0x2c) >>> 0) | 0
      if (chance <= minChance) chance = minChance
      chance = (chance - sdiv32(imul32(fMagic, chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 4
      }
    }
  }

  // 5. Superior (3)
  {
    const chance =
      (((m.u32((pRatio + 0x30) >>> 0) | 0) -
        sdiv32(lvlDiff, m.u32((pRatio + 0x34) >>> 0) | 0)) <<
        7) |
      0
    if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
      return 3
    }
  }

  // 6. Normal (2) vs Low Quality (1)
  {
    const chance =
      (((m.u32((pRatio + 0x38) >>> 0) | 0) -
        sdiv32(lvlDiff, m.u32((pRatio + 0x3c) >>> 0) | 0)) <<
        7) |
      0
    if (chance <= 0) return 2
    return (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80 ? 2 : 1
  }
}

/**
 * Initializes a newly allocated `UNIT_ITEM` (`0x6FC30160..0x6FC301D9`, `122B`):
 * sets `dwUnitId`, `(dwFlags & ~8) | 2`, `ITEMCMD_NEWITEM` (`0x10`), allocates `D2StatListStrc`
 * (`STATLIST_CreateEx113c`), attaches quest item if `bQuest != 0`, and clears unit events.
 *
 * @va D2Game:0x6FC30160 (122B)
 */
export function ITEMS_InitItemUnit_6FC30160_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  dwUnitId = -1,
): number {
  hitD2GameVa113c(0x6FC30160)
  const item = pItem >>> 0
  if (item === 0) return 0
  const uid = dwUnitId >= 0 ? dwUnitId >>> 0 : m.u32((item + 0x0c) >>> 0) >>> 0
  m.setU32((item + 0x0c) >>> 0, uid)
  m.setU32((item + 0xc4) >>> 0, ((m.u32((item + 0xc4) >>> 0) & ~8) | 2) >>> 0)
  ITEMS_SetOrClearCommandFlags113c(m, item, 0x10, 1)
  if (m.u32((item + 0x5c) >>> 0) === 0) {
    STATLIST_CreateEx113c(m, item, 0, 0)
  }
  if (isSgptDataTablesLoaded113c(m)) {
    const nClassId = m.u32((item + 0x04) >>> 0) | 0
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
    if (pItemsTxt !== 0) {
      const bQuest = m.u8((pItemsTxt + 0x12a) >>> 0)
      if (bQuest !== 0 && pGame !== 0) {
        QUESTS_AttachUnitToQuest_6FC55890_113c(m, item, (bQuest - 1) | 0, pGame >>> 0)
      }
    }
  }
  if (m.u32((item + 0xdc) >>> 0) !== 0 && pGame !== 0) {
    EVENT_RemoveUnitEvents113c(m, pGame >>> 0, item)
  }
  m.setU32((item + 0xdc) >>> 0, 0)
  return 1
}

/**
 * Rolls class staffmods (`+1..+3` individual class skills on wands, staves, scepters, orbs,
 * shrunken heads, claws, pelts) on `pItem` (`0x6FC33DE0..0x6FC33E57`, `120B`).
 *
 * @va D2Game:0x6FC33DE0 (120B)
 */
export function ITEMS_RollStaffModsOnItem_6FC33DE0_113c(
  m: Memory113c,
  pItem: number,
  pItemDrop: number,
): void {
  hitD2GameVa113c(0x6FC33DE0)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  if (item === 0 || drop === 0 || !isSgptDataTablesLoaded113c(m)) return

  const staffClass = ITEMS_GetStaffModsClass113c(m, item) | 0
  if (staffClass < 0 || staffClass >= 7) return
  if ((SKILLS_GetClassSkillCount113c(m, staffClass) | 0) <= 0) return

  const baseSkillId = SKILLS_GetClassSkillId113c(m, staffClass, 0) | 0
  const ilvl = m.u32((drop + 0x0c) >>> 0) | 0
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) === 0) {
    ITEMS_AddStaffModSkillsByTier_6FC335E0_113c(m, ilvl, item, baseSkillId)
    return
  }
  const bonus = (m.u8((drop + 0x80) >>> 0) & 0x20) !== 0 ? ilvl : 0
  ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, item, ilvl, baseSkillId, bonus)
}

/**
 * Finalizes type-specific properties on a Normal-quality Expansion (`wItemFormat >= 1`) item:
 * charms (`0x0D`), monster organs (`0x28`), player body parts (`0x07`), scrolls (`0x16`),
 * tomes (`0x12`), and staffmods (`0x6FC33DE0`).
 *
 * @va D2Game:0x6FC30550 (173B)
 */
export function ITEMS_FinalizeNormalExpansionItem_6FC30550_113c(
  m: Memory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC30550)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  if (item === 0 || drop === 0 || !isSgptDataTablesLoaded113c(m)) return 0

  if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x0d) !== 0) {
    ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(m, item, drop)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x28) !== 0) {
    const pSrc = m.u32(drop) >>> 0
    const cell = pSrc !== 0 ? m.u32((pSrc + 0x04) >>> 0) >>> 0 : m.u32((drop + 0x40) >>> 0) >>> 0
    ITEMS_SetItemCell113c(m, item, cell)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x07) !== 0) {
    const pSrc = m.u32(drop) >>> 0
    const cell = pSrc !== 0 ? m.u32((pSrc + 0x04) >>> 0) >>> 0 : m.u32((drop + 0x40) >>> 0) >>> 0
    ITEMS_SetItemCell113c(m, item, cell)
    ITEMS_SetOrClearCommandFlags113c(m, item, 0x10000, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x16) !== 0) {
    const bookIdx = ITEMS_FindSuperiorQualityRecordIndex113c(m, item, 1) | 0
    ITEMS_SetMagicSuffix113c(m, item, bookIdx, 0)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x12) !== 0) {
    const bookIdx = ITEMS_FindSuperiorQualityRecordIndex113c(m, item, 0) | 0
    ITEMS_SetMagicSuffix113c(m, item, bookIdx, 0)
  }
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, item, drop)
  return 1
}

const W4B3_ITEM_HOOKS_113C: K2W4B3Hooks113c = {
  onTryRollAndApplyMagicAffixes_6FC303C0: (mem, pp, dr) =>
    ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(mem, pp, dr),
  onRollAndApplyMagicAffixesStrict_6FC30240: (mem, it, dr) =>
    ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(mem, it, dr),
  onRollRareAffixesExpansion_6FC35240: (mem, it, dr) =>
    ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(mem, it, dr),
  onRollRareAffixesClassic_6FC34F20: (mem, it, dr) =>
    ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(mem, it, dr),
}

const W4B4_ITEM_HOOKS_113C: K2W4B4Hooks113c = {
  onApplyTypeSpecificCreatedItemMods_6FC30600: (mem, it, dr, sp) => {
    ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(mem, it, dr, sp, W4B3_ITEM_HOOKS_113C)
  },
}

/**
 * Dispatches Normal-quality item finalization by `wItemFormat` (`0x6FC30600` when `0`, else `0x6FC30550`).
 *
 * @va D2Game:0x6FC307B0 (35B)
 */
export function ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c(
  m: Memory113c,
  pItemDrop: number,
  pItem: number,
  nSpellArg = 0,
): void {
  hitD2GameVa113c(0x6FC307B0)
  const item = pItem >>> 0
  const drop = pItemDrop >>> 0
  if (item === 0 || drop === 0) return
  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) === 0) {
    ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(
      m,
      item,
      drop,
      nSpellArg,
      W4B3_ITEM_HOOKS_113C,
    )
  } else {
    ITEMS_FinalizeNormalExpansionItem_6FC30550_113c(m, item, drop)
  }
}

function tryFallbackSuperior_6FC301E0_113c(
  m: Memory113c,
  ppItem: number,
  pdwSeed: number,
  pItemDrop: number,
): number {
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, ppItem)
  const pItem0 = m.u32(ppItem) >>> 0
  const saved = m.u32(pdwSeed) >>> 0
  ITEMS_SetOwnerGuid113c(m, pItem0, saved)
  SEED_InitLowSeed113c(m, ITEMS_GetItemSeed113c(m, pItem0) >>> 0, saved)
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, pItem0, pItemDrop)
  ITEMS_SetItemQuality113c(m, pItem0, 3)
  m.setU32((pItemDrop + 0x30) >>> 0, 3)
  m.setU32(pdwSeed, SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, pItem0) >>> 0) >>> 0)
  ITEMS_GetItemFormat113c(m, pItem0)
  return ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(m, pItem0, pItemDrop) | 0
}

/**
 * Generates quality, LowQ/Normal/Superior/Magic/Set/Rare/Unique/Crafted/Tempered affixes and
 * properties, failed-Unique (`3x` durability) / failed-Set (`2x` durability) downgrades,
 * Ethereal (`0x6FC2EBB0`), Sockets (`0x6FC2EC90`), and class `wAutoPrefix` automods (`0x6FC30A20`, `1,558B`).
 *
 * @va D2Game:0x6FC30A20 (1558B)
 */
export function ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c(
  m: Memory113c,
  pGame: number,
  ppItemOrItem: number,
  pItemDrop = 0,
): number {
  hitD2GameVa113c(0x6FC30A20)
  const game = pGame >>> 0
  if (ppItemOrItem === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 1

  const savedSp = itemDropStackCursor113c
  let ppItem = ppItemOrItem >>> 0
  let drop = pItemDrop >>> 0

  try {
    if (m.u32(ppItem) === 4) {
      const slot = pushItemDropStack113c(m, 8)
      m.setU32(slot, ppItem)
      ppItem = slot
    }
    const pItemInit = m.u32(ppItem) >>> 0
    if (pItemInit === 0 || m.u32(pItemInit) !== 4) return 0

    if (drop === 0) {
      drop = pushItemDropStack113c(m, 0x84)
      const pData = m.u32((pItemInit + 0x14) >>> 0) >>> 0
      m.setU32((drop + 0x08) >>> 0, game)
      m.setU32((drop + 0x0c) >>> 0, pData !== 0 ? m.u32((pData + 0x2c) >>> 0) : 1)
      m.setU32((drop + 0x14) >>> 0, m.u32((pItemInit + 0x04) >>> 0))
      m.setU16((drop + 0x2a) >>> 0, ITEMS_GetItemFormat113c(m, pItemInit) & 0xffff)
      m.setU32((drop + 0x30) >>> 0, ITEMS_GetItemQuality113c(m, pItemInit) >>> 0)
    }

    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(
      m,
      m.u32((pItemInit + 0x04) >>> 0) | 0,
    ) >>> 0
    if (pItemsTxt === 0) return 0

    ITEMS_SetAutoAffix113c(m, pItemInit, 0)
    for (let i = 0; i < 3; i++) {
      ITEMS_SetMagicPrefix113c(m, pItemInit, 0, i)
      ITEMS_SetMagicSuffix113c(m, pItemInit, 0, i)
    }
    ITEMS_SetRarePrefix113c(m, pItemInit, 0)
    ITEMS_SetRareSuffix113c(m, pItemInit, 0)

    const rolledQual = ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, pItemInit, drop) | 0
    const forcedQual = m.u32((drop + 0x30) >>> 0) | 0
    const initQual = forcedQual !== 0 ? forcedQual : rolledQual
    ITEMS_SetItemQuality113c(m, pItemInit, initQual)

    if (ITEMS_IsMagicQualityAllowed113c(m, pItemInit) !== 0) {
      if (ITEMS_GetComponentByte113c(m, pItemInit) !== 0) {
        ITEMS_SetItemQuality113c(m, pItemInit, 7)
      } else if (ITEMS_IsHighQualityItem113c(m, pItemInit) === 0) {
        ITEMS_SetItemQuality113c(m, pItemInit, 4)
      }
    }
    if (
      ITEMS_IsRareQualityAllowed113c(m, pItemInit) === 0 &&
      (ITEMS_GetItemQuality113c(m, pItemInit) | 0) === 6
    ) {
      ITEMS_SetItemQuality113c(m, pItemInit, 4)
    }
    if (ITEMS_CheckIfUnique113c(m, pItemInit) !== 0) {
      ITEMS_SetItemQuality113c(m, pItemInit, 7)
    }
    if (ITEMS_IsNormalQualityAllowed113c(m, pItemInit) !== 0) {
      ITEMS_SetItemQuality113c(m, pItemInit, 2)
    }

    const qSwitch = ITEMS_GetItemQuality113c(m, pItemInit) | 0
    if (qSwitch < 1 || qSwitch > 9) return 0

    const pSeedSlot = pushItemDropStack113c(m, 8)

    switch (qSwitch) {
      case 1: {
        const curItem = m.u32(ppItem) >>> 0
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        if (ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c(m, curItem, drop) === 0) {
          ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
            m,
            savedSeed,
            ppItem,
            drop,
            game,
            W4B4_ITEM_HOOKS_113C,
          )
        }
        break
      }
      case 2: {
        ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c(m, drop, m.u32(ppItem) >>> 0, game)
        break
      }
      case 3: {
        const curItem = m.u32(ppItem) >>> 0
        ITEMS_SetItemCell113c(m, curItem, -1)
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        ITEMS_GetItemFormat113c(m, curItem)
        if (ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(m, curItem, drop) === 0) {
          ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
            m,
            savedSeed,
            ppItem,
            drop,
            game,
            W4B4_ITEM_HOOKS_113C,
          )
        }
        break
      }
      case 4: {
        const curItem = m.u32(ppItem) >>> 0
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        m.setU32(pSeedSlot, savedSeed)
        if (ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(m, ppItem, drop) !== 0) {
          ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
        } else if (tryFallbackSuperior_6FC301E0_113c(m, ppItem, pSeedSlot, drop) === 0) {
          ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
            m,
            m.u32(pSeedSlot) >>> 0,
            ppItem,
            drop,
            game,
            W4B4_ITEM_HOOKS_113C,
          )
        }
        break
      }
      case 5: {
        const curItem = m.u32(ppItem) >>> 0
        ITEMS_SetItemCell113c(m, curItem, -1)
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        m.setU32(pSeedSlot, savedSeed)
        if (ITEMS_ApplySetItemModsByFormat_6FC341E0_113c(m, curItem, drop) === 0) {
          const itemAfter = m.u32(ppItem) >>> 0
          if (
            ITEMS_CanItemLoseDurability113c(m, itemAfter) !== 0 &&
            (ITEMS_GetItemFormat113c(m, itemAfter) & 0xffff) >= 1
          ) {
            let dur2 = (STATLIST_GetUnitStat113c(m, itemAfter, 0x48, 0) | 0) * 2
            const maxBase = STATLIST_GetUnitBaseStat113c(m, itemAfter, 0x49, 0) | 0
            if (dur2 >= 0xff) dur2 = 0xff
            STATLIST_SetUnitStat113c(m, itemAfter, 0x48, dur2, 0)
            let max2 = maxBase * 2
            if (max2 >= 0xff) max2 = 0xff
            STATLIST_SetUnitStat113c(m, itemAfter, 0x49, max2, 0)
          }
          if (
            ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(
              m,
              ppItem,
              pSeedSlot,
              drop,
              W4B3_ITEM_HOOKS_113C,
            ) !== 0
          ) {
            ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
          } else if (tryFallbackSuperior_6FC301E0_113c(m, ppItem, pSeedSlot, drop) === 0) {
            ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
              m,
              m.u32(pSeedSlot) >>> 0,
              ppItem,
              drop,
              game,
              W4B4_ITEM_HOOKS_113C,
            )
          }
        }
        break
      }
      case 6: {
        const curItem = m.u32(ppItem) >>> 0
        ITEMS_SetRarePrefix113c(m, curItem, 0)
        ITEMS_SetRareSuffix113c(m, curItem, 0)
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        m.setU32(pSeedSlot, savedSeed)
        if (
          ITEMS_RollRareAffixesByFormat_6FC354F0_113c(m, curItem, drop, W4B3_ITEM_HOOKS_113C) !== 0
        ) {
          ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
        } else if (
          ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(
            m,
            ppItem,
            pSeedSlot,
            drop,
            W4B3_ITEM_HOOKS_113C,
          ) !== 0
        ) {
          ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
        } else if (tryFallbackSuperior_6FC301E0_113c(m, ppItem, pSeedSlot, drop) === 0) {
          ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
            m,
            m.u32(pSeedSlot) >>> 0,
            ppItem,
            drop,
            game,
            W4B4_ITEM_HOOKS_113C,
          )
        }
        break
      }
      case 7: {
        const curItem = m.u32(ppItem) >>> 0
        ITEMS_SetItemCell113c(m, curItem, -1)
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        m.setU32(pSeedSlot, savedSeed)
        if (ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c(m, game, curItem, drop) === 0) {
          const itemAfter = m.u32(ppItem) >>> 0
          if (
            ITEMS_CanItemLoseDurability113c(m, itemAfter) !== 0 &&
            (ITEMS_GetItemFormat113c(m, itemAfter) & 0xffff) >= 1
          ) {
            let dur3 = (STATLIST_GetUnitStat113c(m, itemAfter, 0x48, 0) | 0) * 3
            const maxBase = STATLIST_GetUnitBaseStat113c(m, itemAfter, 0x49, 0) | 0
            if (dur3 >= 0xff) dur3 = 0xff
            STATLIST_SetUnitStat113c(m, itemAfter, 0x48, dur3, 0)
            let max3 = maxBase * 3
            if (max3 >= 0xff) max3 = 0xff
            STATLIST_SetUnitStat113c(m, itemAfter, 0x49, max3, 0)
          }
          if (
            ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(
              m,
              ppItem,
              pSeedSlot,
              drop,
              W4B3_ITEM_HOOKS_113C,
            ) !== 0
          ) {
            ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
          } else if (
            ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(
              m,
              ppItem,
              pSeedSlot,
              drop,
              W4B3_ITEM_HOOKS_113C,
            ) !== 0
          ) {
            ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
          } else if (tryFallbackSuperior_6FC301E0_113c(m, ppItem, pSeedSlot, drop) === 0) {
            ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
              m,
              m.u32(pSeedSlot) >>> 0,
              ppItem,
              drop,
              game,
              W4B4_ITEM_HOOKS_113C,
            )
          }
        }
        break
      }
      case 8: {
        const curItem = m.u32(ppItem) >>> 0
        ITEMS_SetRarePrefix113c(m, curItem, 0)
        ITEMS_SetRareSuffix113c(m, curItem, 0)
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        if (ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c(m, curItem, drop) !== 0) {
          ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, m.u32(ppItem) >>> 0, drop)
        } else {
          ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
            m,
            savedSeed,
            ppItem,
            drop,
            game,
            W4B4_ITEM_HOOKS_113C,
          )
        }
        break
      }
      case 9: {
        const curItem = m.u32(ppItem) >>> 0
        ITEMS_SetRarePrefix113c(m, curItem, 0)
        ITEMS_SetRareSuffix113c(m, curItem, 0)
        const savedSeed = SEED_GetLowSeed113c(m, ITEMS_GetItemSeed113c(m, curItem) >>> 0) >>> 0
        const wPre = ITEMS_RollRareNameIdByFormat_6FC34B30_113c(m, curItem, 1) & 0xffff
        const wSuf = ITEMS_RollRareNameIdByFormat_6FC34B30_113c(m, curItem, 0) & 0xffff
        if (wPre !== 0 && wSuf !== 0) {
          ITEMS_SetRarePrefix113c(m, curItem, wPre)
          ITEMS_SetRareSuffix113c(m, curItem, wSuf)
        } else {
          ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
            m,
            savedSeed,
            ppItem,
            drop,
            game,
            W4B4_ITEM_HOOKS_113C,
          )
        }
        break
      }
      default:
        return 0
    }

    const pFinalItem = m.u32(ppItem) >>> 0
    const finalQual = ITEMS_GetItemQuality113c(m, pFinalItem) | 0
    if (finalQual <= 0 || finalQual >= 10) return 0

    const finalFormat = ITEMS_GetItemFormat113c(m, pFinalItem) & 0xffff
    if (finalFormat >= 100) {
      ITEMS_RollAndApplyEthereal_6FC2EBB0_113c(m, pFinalItem, drop)
    }
    if (finalQual >= 1 && finalQual <= 3) {
      ITEMS_RollAndApplySockets_6FC2EC90_113c(m, pFinalItem, drop, game)
    }

    if (
      finalFormat >= 100 &&
      (finalQual === 3 || finalQual === 4 || finalQual === 6 || finalQual === 8 || finalQual === 9)
    ) {
      const wAutoPrefixGrp = m.u16((pItemsTxt + 0xf8) >>> 0)
      if (wAutoPrefixGrp !== 0) {
        const wAutoId =
          ITEMS_RollMagicAffixByFormat_6FC34B50_113c(
            m,
            pFinalItem,
            1,
            0,
            1,
            1,
            0,
            wAutoPrefixGrp,
          ) & 0xffff
        if (wAutoId > 0) {
          ITEMS_SetAutoAffix113c(m, pFinalItem, wAutoId)
          const pAutoTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wAutoId) >>> 0
          if (pAutoTxt !== 0) {
            ITEMS_ApplyItemQualityMods113c(m, 0, 0, pFinalItem, pAutoTxt, 0, 0)
          }
        }
      }
    }
    return 1
  } finally {
    popItemDropStack113c(savedSp)
  }
}

/**
 * Initializes base item stats (`STAT_GOLD 14`, ammo/stack `STAT_QUANTITY 70`, armor `STAT_TOBLOCK 20`,
 * `STAT_VELOCITYPERCENT 67`, `STAT_DURABILITY 72` / `STAT_MAXDURABILITY 73`, base `STAT_ARMORCLASS 31`,
 * weapon damage `21..24`/`159..160`, `STAT_ATTACKRATE 68`, charm graphic, `nInvGfxIdx`), then invokes
 * `0x6FC30A20` (`ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c`) when `bGenerateQualityMods != 0`.
 *
 * @va D2Game:0x6FC31070 (1050B)
 */
export function ITEMS_InitCreatedItemStats_6FC31070_113c(
  m: Memory113c,
  pGame: number,
  ppItemOrItem: number,
  pItemDrop = 0,
  bGenerateQualityMods = 1,
): number {
  hitD2GameVa113c(0x6FC31070)
  const game = pGame >>> 0
  if (ppItemOrItem === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 1

  const savedSp = itemDropStackCursor113c
  let ppItem = ppItemOrItem >>> 0
  const drop = pItemDrop >>> 0

  try {
    if (m.u32(ppItem) === 4) {
      const slot = pushItemDropStack113c(m, 8)
      m.setU32(slot, ppItem)
      ppItem = slot
    }
    const pItem = m.u32(ppItem) >>> 0
    if (pItem === 0) return 0

    const itemType = ITEMS_GetItemTypeFromItem113c(m, pItem) | 0
    if (itemType === 4) {
      // Gold ('gld ')
      let gold = 1
      if (drop !== 0) {
        const ilvl = m.u32((drop + 0x0c) >>> 0) | 0
        gold = (ilvl + rollLimitedRandomNumber_6FC21180_113c(m, (pItem + 0x20) >>> 0, imul32(ilvl, 5))) | 0
        if (gold <= 0) gold = 1
        const qtyOverride = m.u32((drop + 0x54) >>> 0) | 0
        if (qtyOverride > 0) gold = qtyOverride
      }
      if (gold < 0) {
        STATLIST_SetUnitStat113c(m, pItem, 0x0e, 0, 0)
      } else if (m.u32(pItem) === 0 && gold > (STATLIST_GetUnitGoldBankLimit113c(m, pItem) | 0)) {
        STATLIST_SetUnitStat113c(m, pItem, 0x0e, 0, 0)
      } else {
        STATLIST_SetUnitStat113c(m, pItem, 0x0e, gold, 0)
      }
    } else if (ITEMS_GetItemTypeShootsFromItem113c(m, pItem) !== 0) {
      // Quiver / ammo ('aqv ', 'cqv ')
      const minStack = ITEMS_GetGambleCostFromItem113c(m, pItem) | 0
      const maxStack = ITEMS_GetTotalMaxStack113c(m, pItem) | 0
      let qty =
        (minStack + SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, (maxStack - minStack) | 0)) | 0
      if (qty < 1) qty = 1
      if (drop !== 0) {
        const qtyOv = m.u32((drop + 0x54) >>> 0) | 0
        if (qtyOv > 0) qty = qtyOv
      }
      STATLIST_SetUnitStat113c(m, pItem, 0x46, qty, 0)
    } else {
      const nClassId = m.u32((pItem + 0x04) >>> 0) | 0
      const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
      if (pItemsTxt === 0) return 0

      if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x32) !== 0) {
        // Any Armor (type 50 = 0x32)
        const toBlock = m.u8((pItemsTxt + 0x111) >>> 0)
        STATLIST_SetUnitStat113c(m, pItem, 0x14, toBlock, 0)
        const speed = -(m.u32((pItemsTxt + 0xd8) >>> 0) | 0)
        STATLIST_SetUnitStat113c(m, pItem, 0x43, speed, 0)

        let maxDur = m.u8((pItemsTxt + 0x112) >>> 0)
        const halfDur = maxDur >>> 1
        let curDur = (halfDur + SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, maxDur)) | 0
        if (curDur >= 0xff) curDur = 0xff
        STATLIST_SetUnitStat113c(m, pItem, 0x48, curDur, 0)
        if (maxDur >= 0xff) maxDur = 0xff
        STATLIST_SetUnitStat113c(m, pItem, 0x49, maxDur, 0)

        ITEMS_RollInitialDurabilityStat113c(m, pItem)
      } else if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d) !== 0) {
        // Any Weapon (type 45 = 0x2D)
        if (ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0) {
          const minStack = ITEMS_GetGambleCostFromItem113c(m, pItem) | 0
          const maxStack = ITEMS_GetTotalMaxStack113c(m, pItem) | 0
          let qty =
            (minStack +
              SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, (maxStack - minStack) | 0)) |
            0
          if (drop !== 0) {
            const qtyOv = m.u32((drop + 0x54) >>> 0) | 0
            if (qtyOv > 0) qty = qtyOv
          }
          if (qty < 1) qty = 1
          if (ITEMS_IsHighQualityItem113c(m, pItem) !== 0) qty = 1
          STATLIST_SetUnitStat113c(m, pItem, 0x46, qty, 0)
        }
        let maxDur = m.u8((pItemsTxt + 0x112) >>> 0)
        const halfDur = maxDur >>> 1
        let curDur = (halfDur + SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, maxDur)) | 0
        if (curDur >= 0xff) curDur = 0xff
        STATLIST_SetUnitStat113c(m, pItem, 0x48, curDur, 0)
        if (maxDur >= 0xff) maxDur = 0xff
        STATLIST_SetUnitStat113c(m, pItem, 0x49, maxDur, 0)

        ITEMS_InitBaseWeaponDamageStats_6FC2E860_113c(m, pItem)
        const atkSpeed = -(m.u32((pItemsTxt + 0xd8) >>> 0) | 0)
        STATLIST_SetUnitStat113c(m, pItem, 0x44, atkSpeed, 0)
      } else {
        // Misc stackables / keys / tomes / charms
        if (ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0) {
          const minStack = ITEMS_GetGambleCostFromItem113c(m, pItem) | 0
          const maxStack = ITEMS_GetTotalMaxStack113c(m, pItem) | 0
          let capStack = ITEMS_GetBitField2FromItem113c(m, pItem) | 0
          if (capStack < minStack || capStack === 0) {
            capStack = minStack > maxStack ? minStack : maxStack
          }
          let qty =
            (minStack +
              SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, (capStack - minStack) | 0)) |
            0
          if (drop !== 0) {
            const qtyOv = m.u32((drop + 0x54) >>> 0) | 0
            if (qtyOv > 0) qty = qtyOv
          }
          if (ITEMS_IsHighQualityItem113c(m, pItem) !== 0 || qty < 1) {
            qty = 1
          }
          STATLIST_SetUnitStat113c(m, pItem, 0x46, qty, 0)
        }
        if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x0b) {
          STATLIST_RollRandomItemGraphicStat113c(m, pItem)
        }
      }
    }

    const pCurItem = m.u32(ppItem) >>> 0
    const varGfxCount = ITEMS_GetVarInvGfxCount113c(m, pCurItem) & 0xff
    if (varGfxCount !== 0) {
      const gfxIdx = SEED_RollRangeWithMinFast113c(m, (pCurItem + 0x20) >>> 0, 0, varGfxCount) & 0xff
      ITEMS_SetVarGfxIndex113c(m, pCurItem, gfxIdx)
    }

    let ok = 1
    if (bGenerateQualityMods !== 0 && drop !== 0) {
      ok = ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c(m, game, ppItem, drop) | 0
      const pPostItem = m.u32(ppItem) >>> 0
      const postId = pPostItem !== 0 ? m.u32((pPostItem + 0x04) >>> 0) | 0 : -1
      const pPostTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, postId) >>> 0
      if (
        pPostTxt !== 0 &&
        m.u8((pPostTxt + 0x12a) >>> 0) !== 0 &&
        m.u8((pPostTxt + 0x12b) >>> 0) !== 0 &&
        game !== 0
      ) {
        let pQuestList = STATLIST_GetStatListFromUnitStateOrFlag113c(m, pPostItem, 0, 0x40) >>> 0
        if (pQuestList === 0) {
          pQuestList = STATLIST_AllocList113c(
            m,
            m.u32((pPostItem + 0x08) >>> 0),
            0x40,
            0,
            4,
            m.u32((pPostItem + 0x0c) >>> 0),
          ) >>> 0
          STATLIST_MergeStatLists113c(m, pPostItem, pQuestList, 1)
        }
        STATLIST_SetStat113c(m, pQuestList, 0x164, m.u8((game + 0x6d) >>> 0), 0)
        ITEMS_SetOrClearCommandFlags113c(m, pPostItem, 0x10, 1)
      }
    }
    return ok
  } finally {
    popItemDropStack113c(savedSp)
  }
}

/**
 * Full `D2GAME_CreateItemEx` (`0x6FC31490..0x6FC31873`, `996B`):
 * validates `nItemId` against `Items.txt` (rejecting expansion-only items `wVersion >= 100` in Classic),
 * allocates the `UNIT_ITEM` (`dwUnitType = 4`) via `SUNIT_AllocUnitData113c` (`0x6FD01D90`), sets
 * `0x80000` (`ITEMCMD_INIT`), `wItemFormat`, `ilvl`, `nInvPage = 0xFF`, calls `0x6FC31070`
 * (`ITEMS_InitCreatedItemStats_6FC31070_113c`), applies preset flags when `pDrop->bHasPreset != 0`,
 * sets ground expiration (`pItemData + 0x24`) on `IMODE_ONGROUND (3)`, schedules replenish events
 * (`0x6FC2EA70` / `0x6FC2EA10`), and invokes optional S2C `0x9C` hook.
 *
 * @va D2Game:0x6FC31490 (996B)
 */
export function D2GAME_CreateItemEx_6FC31490_113c(
  m: Memory113c,
  pGame: number,
  pItemDrop: number,
  bForceSeed = 0,
): number {
  hitD2GameVa113c(0x6FC31490)
  const game = pGame >>> 0
  const drop = pItemDrop >>> 0
  if (game === 0 || drop === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 0

  const nItemId = m.u32((drop + 0x14) >>> 0) | 0
  if (m.u32((game + 0x70) >>> 0) === 0) {
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
    if (pItemsTxt === 0 || m.u16((pItemsTxt + 0xf6) >>> 0) >= 100) {
      return 0
    }
  }
  const pItemDataTables = DATATBLS_GetItemDataTables113c(m) >>> 0
  if (pItemDataTables === 0) return 0
  if (nItemId < 0 || nItemId >= (m.u32(pItemDataTables) | 0)) {
    return 0
  }

  const savedSp = itemDropStackCursor113c
  try {
    const eItemMode = m.u32((drop + 0x18) >>> 0) >>> 0
    const x = m.u32((drop + 0x1c) >>> 0) | 0
    const y = m.u32((drop + 0x20) >>> 0) | 0
    const pRoom = m.u32((drop + 0x24) >>> 0) >>> 0
    const wFlags = m.u16((drop + 0x28) >>> 0)
    const dropGame = m.u32((drop + 0x08) >>> 0) >>> 0
    const effGame = dropGame !== 0 ? dropGame : game

    const pItem0 = SUNIT_AllocUnitData113c(
      m,
      4,
      nItemId,
      x,
      y,
      effGame,
      pRoom,
      wFlags,
      eItemMode,
      0,
    ) >>> 0
    if (pItem0 === 0) return 0

    const ppItem = pushItemDropStack113c(m, 8)
    m.setU32(ppItem, pItem0)

    ITEMS_SetOrClearCommandFlags113c(m, pItem0, 0x80000, 1)
    ITEMS_SetItemFormat113c(m, pItem0, m.u16((drop + 0x2a) >>> 0))

    const bHasPreset = m.u32((drop + 0x2c) >>> 0) >>> 0
    if (bForceSeed !== 0 || bHasPreset !== 0) {
      const dwUnitSeed = m.u32((drop + 0x48) >>> 0) >>> 0
      m.setU32((pItem0 + 0x28) >>> 0, dwUnitSeed)
      SEED_InitLowSeed113c(m, (pItem0 + 0x20) >>> 0, dwUnitSeed)
      const dwItemInitSeed = m.u32((drop + 0x4c) >>> 0) >>> 0
      ITEMS_SetOwnerGuid113c(m, pItem0, dwItemInitSeed)
      SEED_InitLowSeed113c(m, ITEMS_GetItemSeed113c(m, pItem0) >>> 0, dwItemInitSeed)
    }

    let ilvl = m.u32((drop + 0x0c) >>> 0) | 0
    if (ilvl <= 0) {
      ilvl = 1
      m.setU32((drop + 0x0c) >>> 0, 1)
    }
    ITEMS_SetItemLevel113c(m, pItem0, ilvl)

    if (bHasPreset === 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem0, 0x2000, 1)
    }
    ITEMS_SetInvPage113c(m, pItem0, 0xff)

    if (ITEMS_InitCreatedItemStats_6FC31070_113c(m, effGame, ppItem, drop, 1) === 0) {
      SUNIT_FreeUnit113c(m, effGame, m.u32(ppItem) >>> 0)
      return 0
    }

    const pItem = m.u32(ppItem) >>> 0
    if (pItem === 0) return 0

    // Note: `0x6FC31490` (`0x6FC315BF..0x6FC31600`) intentionally keeps `0x2000` (`ITEMCMD_NEWITEM`)
    // set on `pItem` until client broadcast (`0x6FC9B1AB -> 0x6FCAD3D0`) and end-of-frame `0x6FD00986` cleanup.
    if (bHasPreset !== 0) {
      const presetFlags = m.u32((drop + 0x44) >>> 0) >>> 0
      ITEMS_SetOrClearCommandFlags113c(
        m,
        pItem,
        0x10,
        ITEMS_TestFlagMask113c(m, presetFlags, 0x10),
      )
      ITEMS_SetOrClearCommandFlags113c(
        m,
        pItem,
        0x1000,
        ITEMS_TestFlagMask113c(m, presetFlags, 0x1000),
      )
      if (
        (ITEMS_GetItemFormat113c(m, pItem) & 0xffff) === 0 &&
        ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 3) === 0 &&
        ITEMS_TestFlagMask113c(m, presetFlags, 0x800) !== 0 &&
        ITEMS_TestFlagMask113c(m, ITEMS_GetCommandFlags113c(m, pItem), 0x800) === 0
      ) {
        const maxSock = ITEMS_GetMaxSocketsFromItemType113c(m, pItem) & 0xff
        if (maxSock !== 0) {
          const guid = ITEMS_GetOwnerGuid113c(m, pItem) >>> 0
          ITEMS_GetMissileWeaponVelocity113c(m, pItem, ((guid % maxSock) + 1) | 0)
        } else {
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x800, 0)
        }
      }
      ITEMS_SetOrClearCommandFlags113c(
        m,
        pItem,
        0x800,
        ITEMS_TestFlagMask113c(m, presetFlags, 0x800),
      )
      ITEMS_SetOrClearCommandFlags113c(
        m,
        pItem,
        0x100,
        ITEMS_TestFlagMask113c(m, presetFlags, 0x100),
      )
      ITEMS_SetOrClearCommandFlags113c(
        m,
        pItem,
        0x20000,
        ITEMS_TestFlagMask113c(m, presetFlags, 0x20000),
      )

      if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 4) {
        STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(
          m,
          pItem,
          0x0e,
          m.u32((drop + 0x34) >>> 0) | 0,
        )
      } else {
        STATLIST_SetUnitStat113c(m, pItem, 0x46, m.u32((drop + 0x34) >>> 0) | 0, 0)
      }

      let presetMaxDur = m.u32((drop + 0x3c) >>> 0) | 0
      if (presetMaxDur >= 0xff) presetMaxDur = 0xff
      m.setU32((drop + 0x3c) >>> 0, presetMaxDur >>> 0)
      let presetDur = m.u32((drop + 0x38) >>> 0) | 0
      if (presetDur > presetMaxDur) presetDur = presetMaxDur
      m.setU32((drop + 0x38) >>> 0, presetDur >>> 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x48, presetDur, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x49, presetMaxDur, 0)
    }

    if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 7) {
      if (bHasPreset !== 0) {
        ITEMS_SetEarName113c(m, pItem, (drop + 0x58) >>> 0)
        ITEMS_SetEarLevel113c(m, pItem, m.u8((drop + 0x50) >>> 0))
        ITEMS_SetOrClearCommandFlags113c(
          m,
          pItem,
          0x8000,
          ITEMS_TestFlagMask113c(m, m.u32((drop + 0x44) >>> 0), 0x8000),
        )
      } else {
        const pDropper = m.u32(drop) >>> 0
        if (pDropper === 0 || m.u32(pDropper) !== 0) {
          SUNIT_FreeUnit113c(m, effGame, pItem)
          return 0
        }
        const pPlrData = UNITS_GetPlayerData113c(m, pDropper) >>> 0
        if (pPlrData === 0) {
          SUNIT_FreeUnit113c(m, effGame, pItem)
          return 0
        }
        ITEMS_SetEarName113c(m, pItem, pPlrData)
        ITEMS_SetEarLevel113c(m, pItem, STATLIST_GetUnitStat113c(m, pDropper, 12, 0) & 0xff)
        const pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
        if (pClient !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x8000, m.u8((pClient + 0x0a) >>> 0) & 4)
        }
      }
    }

    if (ITEMS_TestFlagMask113c(m, ITEMS_GetCommandFlags113c(m, pItem), 0x1000000) !== 0) {
      if (bHasPreset !== 0) {
        ITEMS_SetEarName113c(m, pItem, (drop + 0x58) >>> 0)
      } else {
        const pDropper = m.u32(drop) >>> 0
        const pPlrData = pDropper !== 0 ? UNITS_GetPlayerData113c(m, pDropper) >>> 0 : 0
        if (pPlrData !== 0) {
          ITEMS_SetEarName113c(m, pItem, pPlrData)
        }
      }
    }

    // Set ground expiration frame (`pItemData->dwActionStamp` at `+0x24`) when placed on ground (`eItemMode == 3`)
    if (eItemMode === 3) {
      const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
      if (pItemData !== 0 && m.u32((pItemData + 0x24) >>> 0) === 0) {
        m.setU32(
          (pItemData + 0x24) >>> 0,
          ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, effGame, pItem) >>> 0,
        )
      }
      if (activeRealItemDropHooks113c !== undefined) {
        const cb = activeRealItemDropHooks113c.onWorldItemAction9C
        if (cb !== undefined) {
          const pkt = buildGroundItemPacket9C_6FCAD3D0_113c(m, effGame, pItem, 0)
          cb(pItem, pkt)
        }
      }
    }

    ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, effGame, pItem)
    ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, effGame, pItem)
    return pItem
  } finally {
    popItemDropStack113c(savedSp)
  }
}

/**
 * Finds free ground coordinates near `pDropper` via `0x6FC2E930`, populates a `0x84`-byte
 * `D2ItemDropStrc`, and creates + places the dropped ground `UNIT_ITEM` via `0x6FC31490`.
 *
 * @va D2Game:0x6FC31880 (248B)
 */
export function ITEMS_CreateDroppedItemAtUnit_6FC31880_113c(
  m: Memory113c,
  pDropper: number,
  pGame: number,
  nItemId: number,
  nQuality: number,
  nUniqueSetIdx = 0,
  dwFlags2 = 0,
): number {
  hitD2GameVa113c(0x6FC31880)
  const dropper = pDropper >>> 0
  const game = pGame >>> 0
  if (game === 0 || (nItemId | 0) < 0) return 0

  const savedSp = itemDropStackCursor113c
  try {
    const pCenterCoords = pushItemDropStack113c(m, 8)
    const pOutCoords = pushItemDropStack113c(m, 8)
    const pDrop = pushItemDropStack113c(m, 0x84)

    let pFoundRoom = 0
    if (dropper !== 0) {
      PATH_GetTargetTypeAndPosition113c(m, dropper, pCenterCoords)
      const pDropperRoom = UNITS_GetRoom113c(m, dropper) >>> 0
      pFoundRoom = ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(
        m,
        pDropperRoom,
        pCenterCoords,
        pOutCoords,
        1,
      )
    }
    if (pFoundRoom === 0) {
      return 0
    }

    const wItemFormat = m.u16((game + 0x78) >>> 0)
    const effFormat = wItemFormat !== 0 ? wItemFormat : m.u32((game + 0x70) >>> 0) !== 0 ? 101 : 1
    const ilvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, game, dropper, 0) | 0

    let extraFlags2 = dwFlags2 >>> 0
    if (dropper !== 0 && m.u32(dropper) === 1 && m.u32((dropper + 0x04) >>> 0) === 0x187) {
      extraFlags2 = (extraFlags2 | 1) >>> 0
    }

    m.setU32(pDrop, dropper)
    m.setU32((pDrop + 0x04) >>> 0, 0)
    m.setU32((pDrop + 0x08) >>> 0, game)
    m.setU32((pDrop + 0x0c) >>> 0, ilvl >>> 0)
    m.setU32((pDrop + 0x14) >>> 0, nItemId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, 3)
    m.setU32((pDrop + 0x1c) >>> 0, m.u32(pOutCoords) >>> 0)
    m.setU32((pDrop + 0x20) >>> 0, m.u32((pOutCoords + 4) >>> 0) >>> 0)
    m.setU32((pDrop + 0x24) >>> 0, pFoundRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, effFormat & 0xffff)
    m.setU32((pDrop + 0x30) >>> 0, nQuality >>> 0)
    m.setU32((pDrop + 0x3c) >>> 0, nUniqueSetIdx >>> 0)
    m.setU32((pDrop + 0x80) >>> 0, extraFlags2)

    return D2GAME_CreateItemEx_6FC31490_113c(m, game, pDrop, 0) >>> 0
  } finally {
    popItemDropStack113c(savedSp)
  }
}

function computeEffectiveTcNoDrop_6FC324B5_113c(
  m: Memory113c,
  pGame: number,
  pDropper: number,
  pKiller: number,
  rawNoDrop: number,
  curProb: number,
): number {
  const nd = rawNoDrop | 0
  const pr = curProb | 0
  if (nd <= 0 || pr <= 0) return 0

  let partyCount = 1
  if (pKiller !== 0) {
    let pLeader = pKiller >>> 0
    if (m.u32(pLeader) !== 0) {
      pLeader = AIGENERAL_GetPackLeaderUnit113c(m, pLeader) >>> 0
    }
    if (pLeader !== 0 && m.u32(pLeader) === 0) {
      const cnt = PARTY_CountLivingPartyMembersInSameLevel113c(m, pGame, pLeader) | 0
      if (cnt > 1) {
        partyCount = cnt >= 8 ? 8 : cnt
      }
    }
  }

  const effGamePlayers = GAME_GetEffectivePlayerCount113c(m, pGame) | 0
  let nPartyFactor = (partyCount + sar32((effGamePlayers - partyCount) | 0, 1)) | 0

  if (pDropper !== 0 && m.u32(pDropper) === 1) {
    let monPlrCnt = STATLIST_GetUnitStat113c(m, pDropper, 0x64, 0) | 0
    if (monPlrCnt < 1) monPlrCnt = 1
    if (nPartyFactor >= monPlrCnt) {
      nPartyFactor = monPlrCnt
    }
  }

  if (nPartyFactor <= 1) {
    return nd
  }
  const baseRatio = nd / (nd + pr)
  let ratioPow = baseRatio
  for (let i = 1; i < nPartyFactor; i++) {
    ratioPow *= baseRatio
  }
  const denom = 1.0 - ratioPow
  if (denom < 0.0001) {
    return 0
  }
  return Math.trunc((ratioPow / denom) * pr) | 0
}

/**
 * Evaluates a `TreasureClassEx` tree (`pTcRecord`) against `pDropper->tSeed` (`+0x20`),
 * rolling quality (`0x6FC2FC40`), ethereal/socket TC factor flags (`+0x48` / `+0x4A`),
 * spawning each dropped item on the ground via `0x6FC31880` (`ITEMS_CreateDroppedItemAtUnit_6FC31880_113c`),
 * scaling TC gold multiplier (`+0x0A` `>> 8`), and applying `0x6FC2F260` (`ITEMS_ApplyGoldFindBonus`).
 *
 * @va D2Game:0x6FC32380 (1899B)
 */
export function ITEMS_ChooseTreasureClassAndDrop_6FC32380_113c(
  m: Memory113c,
  pGame: number,
  pDropper: number,
  pKiller: number,
  pTcRecord: number,
  nForcedQuality = 0,
  nDropIlvl = 1,
  bSkipNoDrop = 0,
  ppOutItems = 0,
  pnItemsDropped = 0,
  nMaxDrops = 6,
): number {
  hitD2GameVa113c(0x6FC32380)
  const game = pGame >>> 0
  const dropper = pDropper >>> 0
  const killer = pKiller >>> 0
  const rootTc = pTcRecord >>> 0
  if (game === 0 || dropper === 0 || rootTc === 0) return 0

  const bExp = m.u32((game + 0x70) >>> 0) !== 0 ? 1 : 0
  const maxDrops = ppOutItems === 0 && (nMaxDrops | 0) <= 0 ? 6 : nMaxDrops | 0
  if (pnItemsDropped !== 0) {
    m.setU32(pnItemsDropped >>> 0, 0)
  }

  const savedSp = itemDropStackCursor113c
  // 64 stack slots * 20 bytes (`pTc` u32, `picks` i32, `factors[6]` u16)
  const stackBase = pushItemDropStack113c(m, 64 * 20)
  const pFactorsArg = pushItemDropStack113c(m, 16)

  try {
    const rootPicks = m.u32((rootTc + 0x10) >>> 0) | 0
    const absRootPicks = rootPicks < 0 ? -rootPicks : rootPicks
    m.setU32(stackBase, rootTc)
    m.setU32((stackBase + 4) >>> 0, (absRootPicks > 1 ? absRootPicks : 1) >>> 0)
    for (let k = 0; k < 6; k++) {
      m.setU16((stackBase + 8 + k * 2) >>> 0, m.u16((rootTc + 0x1a + k * 2) >>> 0))
    }

    let sp = 0
    let classRetryCount = 0
    let droppedCount = 0

    outer: while (true) {
      const slotOff = (stackBase + sp * 20) >>> 0
      const pTc = m.u32(slotOff) >>> 0
      if (pTc === 0) {
        if (sp === 0) break
        sp--
        continue
      }
      const prob = bExp !== 0 ? m.u32((pTc + 0x0c) >>> 0) | 0 : m.u32((pTc + 0x08) >>> 0) | 0
      if (prob === 0 || (m.u32((slotOff + 4) >>> 0) | 0) === 0) {
        if (sp === 0) break
        sp--
        continue
      }

      while ((m.u32((stackBase + sp * 20 + 4) >>> 0) | 0) !== 0) {
        const curOff = (stackBase + sp * 20) >>> 0
        const curTc = m.u32(curOff) >>> 0
        const curProb =
          bExp !== 0 ? m.u32((curTc + 0x0c) >>> 0) | 0 : m.u32((curTc + 0x08) >>> 0) | 0
        if (curProb === 0) break

        const nPicks = m.u32((curTc + 0x10) >>> 0) | 0
        const picksBefore = m.u32((curOff + 4) >>> 0) | 0
        let roll = 0

        if (nPicks >= 0) {
          const rawNoDrop = m.u32((curTc + 0x14) >>> 0) | 0
          const effNoDrop =
            rawNoDrop !== 0
              ? computeEffectiveTcNoDrop_6FC324B5_113c(m, game, dropper, killer, rawNoDrop, curProb)
              : 0
          const rollRange = bSkipNoDrop !== 0 ? curProb : (curProb + effNoDrop) | 0
          roll = rollLimitedRandomNumber_6FC21180_113c(m, (dropper + 0x20) >>> 0, rollRange)
          if (bSkipNoDrop === 0) {
            if (roll < effNoDrop) {
              m.setU32((curOff + 4) >>> 0, ((picksBefore - 1) | 0) >>> 0)
              continue
            }
            roll = (roll - effNoDrop) | 0
          }
        } else {
          roll = (-nPicks - picksBefore) | 0
          if (roll >= curProb) break
        }

        const picksAfter = (picksBefore - 1) | 0
        m.setU32((curOff + 4) >>> 0, picksAfter >>> 0)

        const nItemNums = m.u32((curTc + 0x04) >>> 0) | 0
        const pNodes = m.u32((curTc + 0x28) >>> 0) >>> 0
        let nodeIdx = 0

        if (bExp !== 0) {
          let lo = 0
          let hi = nItemNums
          let exact = false
          if (hi > 0) {
            while (lo < hi) {
              const mid = (lo + sar32((hi - lo) | 0, 1)) | 0
              const pref = m.u32((pNodes + imul32(mid, 0x1c) + 0x04) >>> 0) | 0
              if (roll > pref) {
                lo = (mid + 1) | 0
              } else if (roll < pref) {
                hi = mid
              } else {
                nodeIdx = mid
                exact = true
                break
              }
            }
            if (!exact) {
              const c = (lo - 1) | 0
              nodeIdx = c < 0 ? 0 : c
            } else if (lo >= hi) {
              const c = (lo - 1) | 0
              nodeIdx = c < 0 ? 0 : c
            }
          }
        } else {
          nodeIdx = 0
          if (nItemNums > 0) {
            while (nodeIdx < nItemNums) {
              const pNodeCur = (pNodes + imul32(nodeIdx, 0x1c)) >>> 0
              const bNodeFlags = m.u8((pNodeCur + 0x0c) >>> 0)
              if ((bNodeFlags & 0x10) === 0) {
                if (nodeIdx >= nItemNums - 1) break
                const nextPref = m.u32((pNodeCur + 0x1c) >>> 0) | 0
                if (nextPref > roll) break
              }
              nodeIdx = (nodeIdx + 1) | 0
            }
          }
        }

        if (nodeIdx >= nItemNums) continue

        const pNode = (pNodes + imul32(nodeIdx, 0x1c)) >>> 0
        const nodeFlags = m.u8((pNode + 0x0c) >>> 0)

        // Sub-TC recursion (`nodeFlags & 0x04`)
        if ((nodeFlags & 0x04) !== 0) {
          const childTcId = m.u16((pNode + 0x08) >>> 0)
          const pChildTc = DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c(
            m,
            childTcId,
            0,
          ) >>> 0
          const oldOff = curOff
          if (picksAfter > 0) {
            sp = (sp + 1) | 0
            if (sp >= 64) break outer
          }
          const newOff = (stackBase + sp * 20) >>> 0
          m.setU32(newOff, pChildTc)
          if (pChildTc !== 0) {
            const cPicks = m.u32((pChildTc + 0x10) >>> 0) | 0
            const absC = cPicks < 0 ? -cPicks : cPicks
            m.setU32((newOff + 4) >>> 0, (absC > 1 ? absC : 1) >>> 0)
            for (let k = 0; k < 6; k++) {
              const prevF = m.u16((oldOff + 8 + k * 2) >>> 0)
              const childF = m.u16((pChildTc + 0x1a + k * 2) >>> 0)
              m.setU16(
                (newOff + 8 + k * 2) >>> 0,
                prevF === 0 || childF > prevF ? childF : prevF,
              )
            }
          } else {
            m.setU32((newOff + 4) >>> 0, 0)
          }
          continue
        }

        // Leaf item branch
        let wItemId = m.u16((pNode + 0x08) >>> 0)
        if (wItemId === 0xffff) continue

        if (bExp === 0) {
          const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, wItemId) >>> 0
          if (pItemsTxt === 0 || m.u16((pItemsTxt + 0xf6) >>> 0) >= 100) continue
          for (let k = 0; k < 6; k++) {
            const nf = m.u16((pNode + 0x0e + k * 2) >>> 0)
            if (nf > m.u16((curOff + 8 + k * 2) >>> 0)) {
              m.setU16((curOff + 8 + k * 2) >>> 0, nf)
            }
          }
        }

        let uniqueSetIdx = 0
        let quality = 0
        if ((nodeFlags & 0x01) !== 0) {
          uniqueSetIdx = (m.u16((pNode + 0x0a) >>> 0) + 1) & 0xffff
          quality = 7
        } else if ((nodeFlags & 0x02) !== 0) {
          uniqueSetIdx = (m.u16((pNode + 0x0a) >>> 0) + 1) & 0xffff
          quality = 5
        } else if (nForcedQuality !== 0) {
          quality = nForcedQuality | 0
        } else {
          for (let k = 0; k < 6; k++) {
            m.setU16((pFactorsArg + k * 2) >>> 0, m.u16((curOff + 8 + k * 2) >>> 0))
          }
          quality = ITEMS_RollItemQuality_6FC2FC40_113c(
            m,
            game,
            dropper,
            killer,
            wItemId,
            nDropIlvl,
            pFactorsArg,
          )
        }

        let dwDropFlags2 = 0
        const ethFactor = m.u16((curOff + 8 + 8) >>> 0)
        if (ethFactor > 0) {
          const lo = stepSeed64At113c(m, (dropper + 0x20) >>> 0)
          if ((lo & 0x3ff) < ethFactor) {
            dwDropFlags2 = 0x04
          }
        }
        const sockFactor = m.u16((curOff + 8 + 10) >>> 0)
        if (sockFactor > 0) {
          const lo = stepSeed64At113c(m, (dropper + 0x20) >>> 0)
          if ((lo & 0x3ff) < sockFactor) {
            dwDropFlags2 = (dwDropFlags2 | 0x10) >>> 0
          }
        }

        if (bExp === 0) {
          const itemType = ITEMS_IsTome113c(m, wItemId) | 0
          if (ITEMS_GetItemTypeNormal113c(m, itemType) !== 0) {
            const prevRetries = classRetryCount
            classRetryCount = (classRetryCount + 1) | 0
            if (prevRetries < 10) {
              m.setU32((curOff + 4) >>> 0, ((picksAfter + 1) | 0) >>> 0)
              continue
            }
            wItemId = DATATBLS_GetItemIdFromItemCode113c(m, 0x2064736c) & 0xffff
          }
        }

        const pCreated = ITEMS_CreateDroppedItemAtUnit_6FC31880_113c(
          m,
          dropper,
          game,
          wItemId,
          quality,
          uniqueSetIdx,
          dwDropFlags2,
        ) >>> 0
        if (pCreated === 0) continue

        // 0x6FC32A1A..0x6FC32A7B: TC node `wGoldMult` (`+0x0A`) >> 8 on gold piles
        if (ITEMS_CheckItemTypeIdMemPort113c(m, pCreated, 4) !== 0) {
          const wGoldMult = m.u16((pNode + 0x0a) >>> 0)
          if (wGoldMult !== 0) {
            const rawGold = STATLIST_GetUnitStat113c(m, pCreated, 0x0e, 0) | 0
            let scaledGold = sar32(imul32(rawGold, wGoldMult), 8)
            if (scaledGold < 0) {
              scaledGold = 0
            } else if (
              m.u32(pCreated) === 0 &&
              scaledGold > (STATLIST_GetUnitGoldBankLimit113c(m, pCreated) | 0)
            ) {
              scaledGold = 0
            }
            STATLIST_SetUnitStat113c(m, pCreated, 0x0e, scaledGold, 0)
          }
        }

        if (ppOutItems !== 0) {
          m.setU32((ppOutItems + droppedCount * 4) >>> 0, pCreated)
        }
        droppedCount = (droppedCount + 1) | 0
        if (pnItemsDropped !== 0) {
          m.setU32(pnItemsDropped >>> 0, droppedCount >>> 0)
        }
        if (droppedCount >= maxDrops) {
          break outer
        }
        ITEMS_ApplyGoldFindBonus_6FC2F260_113c(m, pCreated, killer)
      }

      if (sp === 0) break
      sp = (sp - 1) | 0
    }

    return droppedCount
  } finally {
    popItemDropStack113c(savedSp)
  }
}

/**
 * Resolves a `TreasureClassEx` record from `(wTcId, nDropIlvl)` (preserving Champion/Unique/Boss
 * tier upgrades unless `bNoUpgrade` or SuperUnique) and invokes `0x6FC32380`.
 *
 * @va D2Game:0x6FC32D60 (131B)
 */
export function ITEMS_DropMonsterTreasure_6FC32D60_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller: number,
  wTcId: number,
  nForcedQuality = 0,
  nDropIlvl = 1,
  bNoUpgrade = 0,
  ppOutItems = 0,
  pnItemsDropped = 0,
  nMaxDrops = 6,
): number {
  hitD2GameVa113c(0x6FC32D60)
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  if (game === 0 || mon === 0 || (wTcId & 0xffff) === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 0

  let lookupLvl = 0
  if (
    m.u32((game + 0x70) >>> 0) !== 0 &&
    m.u8((game + 0x6d) >>> 0) > 0 &&
    bNoUpgrade === 0 &&
    m.u32(mon) === 1
  ) {
    const pMonStats = MONSTATS_GetRecordPtr113c(m, m.u32((mon + 0x04) >>> 0) | 0) >>> 0
    if (pMonStats !== 0) {
      const pBitMasks = safeReadU32_113c(m, D2COMMON_GDWBITMASKS_IAT_VA_113C)
      const mask2 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x08) >>> 0) : 0x04
      const mask6 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x18) >>> 0) : 0x40
      const flags0 = m.u8((pMonStats + 0x0c) >>> 0)
      if ((flags0 & mask2) === 0 && (flags0 & mask6) === 0) {
        lookupLvl = STATLIST_GetUnitStat113c(m, mon, 12, 0) | 0
      }
    }
  }

  const pTc = DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c(
    m,
    wTcId & 0xffff,
    lookupLvl,
  ) >>> 0
  if (pTc === 0) return 0

  return ITEMS_ChooseTreasureClassAndDrop_6FC32380_113c(
    m,
    game,
    mon,
    pKiller >>> 0,
    pTc,
    nForcedQuality,
    nDropIlvl,
    0,
    ppOutItems,
    pnItemsDropped,
    nMaxDrops,
  )
}

/**
 * Resolves the dying monster's `MonStats.txt` / `SuperUniques.txt` TreasureClass ID
 * (Normal `+0x86`, Champion `+0x88`, Unique `+0x8A`, Quest `+0x8C`, SuperUnique `+0x2C`)
 * for `pGame->nDifficulty` (`+0x6D`) and invokes `0x6FC32D60` (`ITEMS_DropMonsterTreasure`).
 *
 * @va D2Game:0x6FC95680 (591B)
 */
export function MONSTER_DropTreasureOnDeath_6FC95680_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  bNoUpgrade = 0,
): number {
  hitD2GameVa113c(0x6FC95680)
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  if (game === 0 || mon === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 0

  const pRoom = UNITS_GetRoom113c(m, mon) >>> 0
  if (pRoom === 0) return 0

  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  DRLG_GetActNoFromLevelId113c(m, levelId)

  const classId = m.u32((mon + 0x04) >>> 0) | 0
  const pMonStats = MONSTATS_GetRecordPtr113c(m, classId) >>> 0
  if (pMonStats === 0) return 0

  const diff = m.u8((game + 0x6d) >>> 0)
  const dropIlvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, game, mon, levelId) | 0

  let wTcId = 0
  const hcSuId = MONSTER_GetSuperUniqueId113c(m, mon) | 0
  if (hcSuId !== -1) {
    const pSuRec = DATATBLS_GetSuperUniquesTxtRecord113c(m, hcSuId) >>> 0
    if (pSuRec !== 0) {
      wTcId = m.u16((pSuRec + diff * 2 + 0x2c) >>> 0)
    } else {
      wTcId = m.u16((pMonStats + diff * 8 + 0x8a) >>> 0)
    }
  } else if (MONSTER_CheckTypeFlagsMask113c(m, mon, 4) !== 0) {
    wTcId = m.u16((pMonStats + diff * 8 + 0x88) >>> 0)
  } else if (MONSTER_CheckTypeFlagsMask113c(m, mon, 8) !== 0) {
    wTcId = m.u16((pMonStats + diff * 8 + 0x8a) >>> 0)
  } else {
    wTcId = m.u16((pMonStats + diff * 8 + 0x86) >>> 0)
  }

  // Quest TC override (`MonStats + 0x9E` = `nTcQuestId`, `+0x9F` = `nTcQuestCp`, `+0x8C` = `wTreasureClass4`)
  const tcQuestId = m.u8((pMonStats + 0x9e) >>> 0)
  const wQuestTc = m.u16((pMonStats + diff * 8 + 0x8c) >>> 0)
  if (tcQuestId > 0 && wQuestTc > 0 && pKiller !== 0) {
    let effKiller = pKiller >>> 0
    if (m.u32(effKiller) !== 0) {
      effKiller = AIGENERAL_GetPackLeaderUnit113c(m, effKiller) >>> 0
      if (STATES_CheckStateMask30OnUnit113c(m, pKiller >>> 0) !== 0) {
        const pConvList = STATLIST_GetStatListFromUnitAndFlag113c(m, pKiller >>> 0, 0x800) >>> 0
        if (pConvList !== 0) {
          const ownType = STATLIST_GetOwnerType113c(m, pConvList) | 0
          const ownId = STATLIST_GetOwnerId113c(m, pConvList) >>> 0
          const pConvOwner = SUNIT_GetServerUnit113c(m, game, ownType, ownId) >>> 0
          if (pConvOwner !== 0) effKiller = pConvOwner
        }
      }
    }
    if (effKiller !== 0 && m.u32(effKiller) === 0) {
      const pQuestFlags = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, effKiller, game) >>> 0
      if (pQuestFlags !== 0) {
        const tcQuestCp = m.u8((pMonStats + 0x9f) >>> 0)
        if (
          DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, tcQuestId, 0x0f) !== 1 &&
          DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, tcQuestId, 0x01) !== 1 &&
          DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, tcQuestId, tcQuestCp) !== 1
        ) {
          wTcId = wQuestTc
        }
      }
    }
  }

  return ITEMS_DropMonsterTreasure_6FC32D60_113c(
    m,
    game,
    mon,
    pKiller >>> 0,
    wTcId,
    0,
    dropIlvl,
    bNoUpgrade,
    0,
    0,
    6,
  )
}

/**
 * Checks monster no-drop / summoned flags (`(pMonster->dwFlags >> 17) & 1 == 0`), class guard
 * (`dwClassId != 0x158`), and ground tile walkability (`COLLISION_CheckSubtileMask(..., 0x801) == 0`),
 * then invokes `0x6FC95680` (`MONSTER_DropTreasureOnDeath_6FC95680_113c`).
 *
 * @va D2Game:0x6FC95900 (171B)
 */
export function MONSTER_DropDeathItems_6FC95900_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
): number {
  hitD2GameVa113c(0x6FC95900)
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  if (game === 0 || mon === 0) return 0
  if (!isSgptDataTablesLoaded113c(m)) return 0

  const dwFlags = m.u32((mon + 0xc4) >>> 0) >>> 0
  if (((dwFlags >>> 17) & 1) !== 0) return 0
  if ((m.u32((mon + 0x04) >>> 0) | 0) === 0x158) return 0

  const pRoom = UNITS_GetRoom113c(m, mon) >>> 0
  if (pRoom === 0) return 0
  const x = UNIT_GetPosX113c(m, mon) | 0
  const y = UNIT_GetPosY113c(m, mon) | 0
  if ((COLLISION_CheckSubtileMask113c(m, pRoom, x, y, 0x801) & 0xffff) !== 0) {
    return 0
  }
  if (MONSTATS_GetRecordPtr113c(m, m.u32((mon + 0x04) >>> 0) | 0) === 0) {
    return 0
  }
  return MONSTER_DropTreasureOnDeath_6FC95680_113c(m, game, mon, pKiller >>> 0, 0)
}

/**
 * Applies equipped armor (`10%` on `pOwner + 0x20`) or weapon (`4%`, `10%` for Expansion throw items)
 * durability loss (`0x6FC32EE0..0x6FC33179`, `666B`):
 * decrements `STAT_DURABILITY (72)`, schedules replenish event (`0x6FC2EA70`), syncs `0x3E` stat
 * packet (`0x6FCAB010`), or breaks / consumes stack at zero durability (`0x6FCF5740`).
 *
 * @va D2Game:0x6FC32EE0 (666B)
 */
export function ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c(
  m: Memory113c,
  pGame: number,
  pOwner: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC32EE0)
  const game = pGame >>> 0
  const owner = pOwner >>> 0
  const item = pItem >>> 0
  if (item === 0) return 0

  if (!isSgptDataTablesLoaded113c(m)) {
    const maxDur = STATLIST_GetUnitStat113c(m, item, 0x49, 0) | 0
    const curDur = STATLIST_GetUnitStat113c(m, item, 0x48, 0) | 0
    if (maxDur <= 0 || curDur <= 0) return 0
    const pSeedFallback = owner !== 0 ? (owner + 0x20) >>> 0 : (item + 0x20) >>> 0
    if (((stepSeed64At113c(m, pSeedFallback) >>> 0) % 100) >= 10) return 0
    const next = curDur > 1 ? (curDur - 1) | 0 : 0
    STATLIST_SetUnitStat113c(m, item, 0x48, next, 0)
    return 1
  }

  const isArmor = ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x32) | 0
  const isWeapon = ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x2d) | 0
  if (isArmor === 0 && isWeapon === 0) return 0
  if (ITEMS_CanItemLoseDurability113c(m, item) === 0) return 0

  let chancePct = 4
  if (isArmor !== 0) {
    chancePct = 10
  } else if (ITEMS_CheckIfThrowItemMemPort113c(m, item) !== 0) {
    if (game !== 0 && m.u32((game + 0x70) >>> 0) === 0) return 0
    chancePct = 10
  }

  const pSeed = owner !== 0 ? (owner + 0x20) >>> 0 : (item + 0x20) >>> 0
  const newLo = stepSeed64At113c(m, pSeed)
  if (((newLo >>> 0) % 100) >= (chancePct >>> 0)) {
    return 0
  }

  let nextDur = (STATLIST_GetUnitStat113c(m, item, 0x48, 0) | 0) - 1
  if (nextDur > 0) {
    const maxDur = STATLIST_GetMaxDurabilityFromUnit113c(m, item) | 0
    if (nextDur >= maxDur) nextDur = maxDur
    if (game !== 0) {
      ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, game, item)
    }
    STATLIST_SetUnitStat113c(m, item, 0x48, nextDur, 0)
    let pClient = 0
    if (owner !== 0 && m.u32(owner) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, owner) >>> 0
      if (pPlrData !== 0) {
        pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
    }
    NET_SendPacket0x3E_ItemStatBitStream113c(m, item, 0, pClient, 1, 0x48, nextDur)
    return 1
  }

  if (isWeapon === 0 || ITEMS_CheckCommandFlags113c(m, item, 0x100) === 0) {
    if (game !== 0 && owner !== 0) {
      ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(m, game, owner, item)
    } else {
      STATLIST_SetUnitStat113c(m, item, 0x48, 0, 0)
    }
    return 1
  }

  if ((ITEMS_GetItemFormat113c(m, item) & 0xffff) >= 1) {
    const curQty = STATLIST_GetUnitStat113c(m, item, 0x46, 0) | 0
    if (curQty > 1) {
      const nextQty = (curQty - 1) | 0
      STATLIST_SetUnitStat113c(m, item, 0x46, nextQty, 0)
      let pClient = 0
      if (owner !== 0 && m.u32(owner) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, owner) >>> 0
        if (pPlrData !== 0) pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
      NET_SendPacket0x3E_ItemStatBitStream113c(m, item, 0, pClient, 1, 0x46, nextQty)
      const resetDur = STATLIST_GetMaxDurabilityFromUnit113c(m, item) | 0
      STATLIST_SetUnitStat113c(m, item, 0x48, resetDur, 0)
      NET_SendPacket0x3E_ItemStatBitStream113c(m, item, 0, pClient, 1, 0x48, resetDur)
      return 1
    }
  }
  STATLIST_SetUnitStat113c(m, item, 0x48, 0, 0)
  return 1
}

/** `.data` 8-direction neighbor tables at `0x6FD2E00C` / `0x6FD2E02C` read by `0x6FC51000`. */
const CLUSTER_DX_6FD2E00C: readonly number[] = [-1, 0, 1, -1, 1, -1, 0, 1]
const CLUSTER_DY_6FD2E02C: readonly number[] = [-1, -1, -1, 0, 0, 1, 1, 1]

/** `.data` theme object ID tables at `0x6FD2E1E4..0x6FD2E22C` read by `0x6FC51000`. */
const THEME_OBJS_1_6FD2E1E4: readonly number[] = [0x4f, 0x35, 0x01]
const THEME_OBJS_3_6FD2E1F0: readonly number[] = [0x03, 0x1c]
const THEME_OBJS_4_6FD2E1F8: readonly number[] = [0x04, 0x09, 0x34, 0x5e, 0x5f]
const THEME_OBJS_59_6FD2E20C: readonly number[] = [0x59, 0x11c]
const THEME_OBJS_D0_6FD2E214: readonly number[] = [0xd0, 0xd1]

/**
 * Spawns themed object clusters (`nThemeObjId` in `{1, 3, 4, 0x4F, 0x59, 0xD0, 0xD1}`) inside `pRoom`
 * using `[pGame + 0x10F0]` (`pObjectControl->tSeed`), `0x6FC4E660` / `0x6FC4E5D0` margin checks, and
 * `0x6FD00F40` (`0x6FC51000..0x6FC517EA`, `2027B`); or places a ground `UNIT_ITEM` near `pSourceOrRoom`
 * via `0x6FC2E930` + `0x6FC2E990` when invoked as the K1 item-placement wrapper.
 *
 * @va D2Game:0x6FC51000 (2027B)
 */
export function OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(
  m: Memory113c,
  pGame: number,
  pSourceOrRoom: number,
  pItemOrDensity: number,
  nThemeObjId = 0,
  nChancePct = 100,
  _bUnused = 0,
): number {
  hitD2GameVa113c(0x6FC51000)
  const game = pGame >>> 0
  const src = pSourceOrRoom >>> 0
  const arg3 = pItemOrDensity >>> 0

  // Genuine `0x6FC51000` (`OBJECTS_SPAWN_FN_TABLE_6FD2E190[1]`):
  // `ecx = pGame`, `edx = pRoom`, `[ebp+8] = nDensity`, `[ebp+0xC] = nThemeObjId`, `[ebp+0x10] = wChancePct`.
  const isItemTarget = arg3 >= 0x1000 && safeReadU32_113c(m, arg3) === 4
  if (!isItemTarget && (nThemeObjId | 0) > 0) {
    if (game === 0 || src === 0) return 0
    const pRoom = src
    const themeId = nThemeObjId | 0
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, themeId) >>> 0
    if (pObjTxt === 0) return 0
    const nSizeX = m.u32((pObjTxt + 0xd0) >>> 0) | 0
    const nSizeY = m.u32((pObjTxt + 0xd4) >>> 0) | 0

    const pSeed = m.u32((game + 0x10f0) >>> 0) >>> 0
    if (pSeed === 0) return 0

    const savedSp = itemDropStackCursor113c
    const pRoomCoords = pushItemDropStack113c(m, 0x20)
    const pPos = pushItemDropStack113c(m, 0x08)
    try {
      DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
      const chanceRoll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      if (chanceRoll > (nChancePct & 0xffff)) {
        return 0
      }

      let objTable: readonly number[]
      let maxTries = 0x0c
      let bTightMargin = 0
      let stepJitter = 5
      let stepBase = 5
      if (themeId === 3) {
        objTable = THEME_OBJS_3_6FD2E1F0
        maxTries = 0x12
      } else if (themeId === 0x4f || themeId === 1) {
        objTable = THEME_OBJS_1_6FD2E1E4
      } else if (themeId === 4) {
        objTable = THEME_OBJS_4_6FD2E1F8
        bTightMargin = 1
        stepJitter = 0
        stepBase = 1
      } else if (themeId === 0x59) {
        objTable = THEME_OBJS_59_6FD2E20C
      } else if (themeId === 0xd0 || themeId === 0xd1) {
        objTable = THEME_OBJS_D0_6FD2E214
        bTightMargin = 1
        stepJitter = 0
        stepBase = 1
      } else {
        return 0
      }

      const roomW = m.u32((pRoomCoords + 0x08) >>> 0) | 0
      const roomH = m.u32((pRoomCoords + 0x0c) >>> 0) | 0
      const densityByte = arg3 & 0xff
      let remClusters = sar32(imul32(sar32(imul32(roomH, roomW), 7), densityByte), 8)
      if (remClusters <= 0) {
        return 0
      }

      const subX = m.u32(pRoomCoords) | 0
      const subY = m.u32((pRoomCoords + 0x04) >>> 0) | 0
      const tblLen = objTable.length
      let lastSpawnedObj = 0

      while (maxTries > 0 && remClusters > 0) {
        const idx0 = rollLimitedRandomNumber_6FC21180_113c(m, pSeed, tblLen)
        const seedObjId = objTable[idx0]!
        let curX =
          (subX + rollLimitedRandomNumber_6FC21180_113c(m, pSeed, (roomW - nSizeX - 1) | 0)) | 0
        let curY =
          (subY + rollLimitedRandomNumber_6FC21180_113c(m, pSeed, (roomH - nSizeY - 1) | 0)) | 0
        m.setU32(pPos, curX >>> 0)
        m.setU32((pPos + 4) >>> 0, curY >>> 0)

        if (
          OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(
            m,
            pRoomCoords,
            pPos,
            nSizeX,
            pRoom,
            nSizeY,
          ) === 1
        ) {
          const pSeedObj = SUNIT_AllocUnitData113c(
            m,
            2,
            seedObjId,
            curX,
            curY,
            game,
            pRoom,
            1,
            0,
            0,
          ) >>> 0
          if (pSeedObj !== 0) {
            m.setU32((pSeedObj + 0xc4) >>> 0, (m.u32((pSeedObj + 0xc4) >>> 0) | 0x10) >>> 0)
            m.setU32((pSeedObj + 0xd0) >>> 0, 0x0b)
          }
          lastSpawnedObj = 0

          let clusterCount = 1
          let canGrow = 1
          while (true) {
            const halfCluster = sar32(clusterCount, 1)
            if (halfCluster > 0) {
              if (rollLimitedRandomNumber_6FC21180_113c(m, pSeed, halfCluster) !== 0) {
                break
              }
            }
            if (canGrow === 0) {
              break
            }
            canGrow = 0
            const maxNeighbors = imul32(remClusters >= 4 ? remClusters : 4, 3)
            let spotOk = 0
            for (let t = 0; t < maxNeighbors; t++) {
              const dir = stepSeed64At113c(m, pSeed) & 7
              const jx =
                (stepBase + rollLimitedRandomNumber_6FC21180_113c(m, pSeed, stepJitter)) | 0
              curX = (curX + imul32(jx, CLUSTER_DX_6FD2E00C[dir]!) * 2) | 0
              const jy =
                (stepBase + rollLimitedRandomNumber_6FC21180_113c(m, pSeed, stepJitter)) | 0
              curY = (curY + imul32(jy, CLUSTER_DY_6FD2E02C[dir]!) * 2) | 0
              m.setU32(pPos, curX >>> 0)
              m.setU32((pPos + 4) >>> 0, curY >>> 0)
              spotOk =
                bTightMargin !== 0
                  ? OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(
                      m,
                      pRoomCoords,
                      pPos,
                      pRoom,
                      nSizeX,
                      nSizeY,
                    ) | 0
                  : OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(
                      m,
                      pRoomCoords,
                      pPos,
                      nSizeX,
                      pRoom,
                      nSizeY,
                    ) | 0
              if (spotOk !== 0) {
                break
              }
            }
            if (spotOk === 0) {
              continue
            }
            canGrow = 1
            const idxN = rollLimitedRandomNumber_6FC21180_113c(m, pSeed, tblLen)
            const nextObjId = objTable[idxN]!
            const pExtraObj = SUNIT_AllocUnitData113c(
              m,
              2,
              nextObjId,
              curX,
              curY,
              game,
              pRoom,
              1,
              0,
              0,
            ) >>> 0
            if (pExtraObj !== 0) {
              m.setU32((pExtraObj + 0xc4) >>> 0, (m.u32((pExtraObj + 0xc4) >>> 0) | 0x10) >>> 0)
              m.setU32((pExtraObj + 0xd0) >>> 0, 0x0b)
            }
            lastSpawnedObj = pExtraObj
            clusterCount = (clusterCount + 1) | 0
          }
          remClusters = (remClusters - 1) | 0
        }
        maxTries = (maxTries - 1) | 0
      }
      return lastSpawnedObj
    } finally {
      popItemDropStack113c(savedSp)
    }
  }

  if (arg3 === 0) return 0

  // Ground item spiral placement branch (`0x6FC2E930` + `0x6FC2E990`)
  const pItem = arg3
  const savedSp = itemDropStackCursor113c
  const pCenter = pushItemDropStack113c(m, 8)
  const pOut = pushItemDropStack113c(m, 8)
  try {
    const pRoom = src !== 0 ? UNITS_GetRoom113c(m, src) >>> 0 : 0
    if (src !== 0) {
      PATH_GetTargetTypeAndPosition113c(m, src, pCenter)
    }
    if (pRoom !== 0 && isSgptDataTablesLoaded113c(m)) {
      const pFoundRoom = ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(
        m,
        pRoom,
        pCenter,
        pOut,
        1,
      ) >>> 0
      if (pFoundRoom !== 0) {
        const outX = m.u32(pOut) | 0
        const outY = m.u32((pOut + 4) >>> 0) | 0
        ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
          m,
          outY,
          pItem,
          pFoundRoom,
          game,
          0,
          outX,
        )
        return pItem
      }
    }
    // Synthetic fallback when room collision grid is not hydrated
    m.setU32((pItem + 0x10) >>> 0, 3)
    let pStaticPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
    if (pStaticPath === 0) {
      pStaticPath = m.alloc(0x20) >>> 0
      m.fill(pStaticPath, 0x20, 0)
      m.setU32((pItem + 0x2c) >>> 0, pStaticPath)
    }
    m.setU32(pStaticPath, pRoom)
    m.setU32((pStaticPath + 4) >>> 0, m.u32(pCenter))
    m.setU32((pStaticPath + 8) >>> 0, m.u32((pCenter + 4) >>> 0))
    return pItem
  } finally {
    popItemDropStack113c(savedSp)
  }
}

/**
 * End-of-frame `UNIT_ITEM` room update flag cleanup (`0x6FD00986..0x6FD009B5`):
 * clears `UNITFLAG_DROPPED` (`0x1000` on `pItem->dwFlags +0xC4`) and `ITEMCMD_0x20` + `ITEMCMD_NEWITEM` (`0x2000`)
 * after client `0x9C` packets have been emitted, matching post-frame `t4` `dwCommandFlags == 0x80010`.
 */
export function SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(
  m: Memory113c,
  pItem: number,
): void {
  const item = pItem >>> 0
  if (item === 0) return
  m.setU32((item + 0xc4) >>> 0, (m.u32((item + 0xc4) >>> 0) & 0xffffefff) >>> 0)
  if (m.u32(item) === 4) {
    ITEMS_SetOrClearCommandFlags113c(m, item, 0x20, 0)
    ITEMS_SetOrClearCommandFlags113c(m, item, 0x2000, 0)
  }
}

/**
 * Clean 1-call integration entry point for `replay-kernel-113c.ts` monster death item drops:
 * runs the complete genuine `0x6FC95900 -> 0x6FC95680 -> 0x6FC32D60 -> 0x6FC32380 -> 0x6FC31880 ->
 * 0x6FC31490` `D2Game.dll` pipeline on `SparseMemory113c` with optional S2C `0x9C` packet capture.
 */
export { ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c }

export function dropMonsterDeathItemsOnMemory113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller = 0,
  hooks?: RealItemDropHooks113c,
): number {
  const prevHooks = activeRealItemDropHooks113c
  activeRealItemDropHooks113c = hooks
  try {
    return MONSTER_DropDeathItems_6FC95900_113c(m, pGame, pMonster, pKiller)
  } finally {
    activeRealItemDropHooks113c = prevHooks
  }
}
