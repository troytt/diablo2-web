/**
 * Milestone 33 [K2] Wave 5 Batch 4 (`w5b4`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FCDC840..0x6FCE3BD0`.
 *
 * Clean-room 1:1 binary-accurate translations from `D2Game.dll` v1.13c.
 */

import { UNITS_GetPlayerData113c, UNITS_GetStashGoldLimit113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32 } from '../common/int-math.ts'
import {
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemCount113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record.ts'
import {
  SKILLS_GetCharges113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_SetCharges113c,
} from '../common/skills.ts'
import {
  DRLGLOGIC_GetBossTombLevel113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_SetWeaponStatListActive113c,
  STATLIST_UnlinkSubList113c,
  STATLIST_UnlinkUnitStatList113c,
} from '../common/statlist.ts'
import { UNITS_GetRoom113c, UNITS_SetUnitUpdateFlags113c } from '../common/unit.ts'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import { DATATBLS_GetItemsTxtRecordByCode113c } from '../tables/datatbls-113c.ts'
import { DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c } from '../tables/monster-tbls-113c.ts'
import { D2GAME_ARENA_FindPlayerSlotByUnit113c } from './boot-init-gap-b-113c.ts'
import { SKILLS_AssignHandSkillAndSyncAura113c } from './k2-gap-melee-dot-113c.ts'
import {
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_HasPlayerGuidInQuest113c,
} from './k2-items-tc-w1-113c.ts'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import { MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c } from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c,
  SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c,
} from './k2-w2b4-113c.ts'
import {
  ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c,
  STATES_PurgeExpStateStatLists_6FCDC920_113c,
} from './k2-w2b6-113c.ts'
import {
  ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c,
  ACT2Q3_GetAltarState_6FCE2120_113c,
  ACT2Q3_IsEclipseInactive_6FCE21A0_113c,
} from './k2-w2b7-113c.ts'
import { NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c } from './k2-w4b5-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { SEED_RollLimitedFast113c } from './regpop-spawn-113c.ts'
import { UNITS_GetOctileDistanceToCoordinates113c } from './town-npc-ai-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** Reentrant scratch stack region for local out-parameter dwords. */
let k2W5B4StackPtr = 0x7ef94000

/**
 * Checks if `pItem` belongs to `pPlayer`'s NPC trade/gamble inventory slot on `pNpc`
 * or has command flag `0x10` set.
 * @va D2Game:0x6FCDC840
 */
export function NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pNpc: number,
  pItem: number,
  bSkipStockLookup: number,
): number {
  hitD2GameVa113c(0x6FCDC840)
  const sp = k2W5B4StackPtr
  k2W5B4StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    const nClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) >>> 0 : 0xffffffff
    const pSlot = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, sp, pGame >>> 0, nClassId) >>> 0
    if (pSlot === 0) return 1
    const pNode =
      SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, pPlayer >>> 0, pSlot, pGame >>> 0) >>> 0
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
    if (pNode !== 0 && m.u8((pNode + 0x04) >>> 0) !== 0) {
      if (bSkipStockLookup !== 0) return 1
      const pNpcSlot =
        SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c(m, pNpc >>> 0, pGame >>> 0, (sp + 0x04) >>> 0) >>> 0
      let pStockNode = m.u32((pNpcSlot + 0x08) >>> 0) >>> 0
      while (pStockNode !== 0) {
        if ((m.u32((pStockNode + 0x04) >>> 0) >>> 0) === dwPlayerGuid) {
          const pInventory = m.u32(pStockNode) >>> 0
          let pCurNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
          while (pCurNode !== 0) {
            if ((INVENTORY_UnitIsItem113c(m, pCurNode) >>> 0) === (pItem >>> 0)) return 1
            pCurNode = INVENTORY_GetNextItem113c(m, pCurNode) >>> 0
          }
          return 0
        }
        pStockNode = m.u32((pStockNode + 0x08) >>> 0) >>> 0
      }
      return 0
    }
    return ITEMS_CheckCommandFlags113c(m, pItem >>> 0, 0x10, 0x100d, 0x6fd1b3a4) !== 0 ? 1 : 0
  } finally {
    k2W5B4StackPtr = sp
  }
}

/**
 * Iterates all items in `pUnit->pInventory` (`+0x60`) and refreshes weapon statlist active state.
 * @va D2Game:0x6FCDCA20
 */
export function NPC_RefreshInventoryItemStatLists_6FCDCA20_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCDCA20)
  if (pUnit === 0) return 0
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0
  const sp = k2W5B4StackPtr
  k2W5B4StackPtr = (sp + 0x08) >>> 0
  try {
    let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
    while (pNode !== 0) {
      const pNext = INVENTORY_GetNextItem113c(m, pNode) >>> 0
      const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
      m.setU32(sp, 0)
      if (pItem !== 0 && (m.u32(pItem) >>> 0) === 4) {
        if (STATLIST_GetOwnerAndDynamicFlag113c(m, pItem, sp) !== 0) {
          STATLIST_UnlinkUnitStatList113c(m, pUnit >>> 0, pItem)
          STATLIST_SetWeaponStatListActive113c(m, pUnit >>> 0, pItem, m.u32(sp))
        }
      }
      pNode = pNext
    }
    return 1
  } finally {
    k2W5B4StackPtr = sp
  }
}

/**
 * Checks whether `pItem`'s base code is in `pNpc`'s permanent stock list or is a difficulty>0 high-tier potion.
 * @va D2Game:0x6FCDCAA0
 */
export function NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(
  m: D2KernMemory113c,
  pNpc: number,
  pGame: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCDCAA0)
  const sp = k2W5B4StackPtr
  k2W5B4StackPtr = (sp + 0x08) >>> 0
  try {
    m.setU32(sp, 0)
    const nClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) >>> 0 : 0xffffffff
    const pSlot = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, sp, pGame >>> 0, nClassId) >>> 0
    if (pSlot === 0) return 0
    const dwBaseCode = ITEMS_GetBaseCode113c(m, pItem >>> 0) >>> 0
    if (m.u8((pGame + 0x6d) >>> 0) > 0) {
      if (
        dwBaseCode === 0x20347068 ||
        dwBaseCode === 0x20357068 ||
        dwBaseCode === 0x2034706d ||
        dwBaseCode === 0x2035706d
      ) {
        return 1
      }
    }
    const nCount = m.u32((pSlot + 0x38) >>> 0) | 0
    if (nCount > 0) {
      let pCode = m.u32((pSlot + 0x34) >>> 0) >>> 0
      for (let i = 0; i < nCount; i = (i + 1) | 0) {
        if ((m.u32(pCode) >>> 0) === dwBaseCode) return 1
        pCode = (pCode + 0x04) >>> 0
      }
    }
    return 0
  } finally {
    k2W5B4StackPtr = sp
  }
}

/**
 * Resets `pPlayer` NPC interaction fields and removes `pPlayer` from `pNpcUnit`'s monster interact list.
 * @va D2Game:0x6FCDCB90
 */
export function NPC_ClearPlayerInteractState_6FCDCB90_113c(
  m: D2KernMemory113c,
  pNpcUnit: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCDCB90)
  m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff)
  m.setU32((pPlayer + 0x68) >>> 0, 6)
  m.setU8((pPlayer + 0x6c) >>> 0, 0)
  if (pNpcUnit !== 0 && (m.u32(pNpcUnit >>> 0) >>> 0) === 1) {
    const pMonsterData = m.u32((pNpcUnit + 0x14) >>> 0) >>> 0
    if (pMonsterData !== 0) {
      const pInteract = m.u32((pMonsterData + 0x30) >>> 0) >>> 0
      MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, pInteract, pPlayer >>> 0, pGame >>> 0)
      return
    }
  }
  MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, 0, pPlayer >>> 0, pGame >>> 0)
}

/**
 * Restores `pUnit` hitpoints to max life, purges expired state statlists, and removes poison/freeze statlists.
 * @va D2Game:0x6FCDCBE0
 */
export function NPC_HealAndCureUnit_6FCDCBE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pbChanged: number,
): void {
  hitD2GameVa113c(0x6FCDCBE0)
  const nCurLife = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0
  if (nCurLife < nMaxLife) {
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 6, nMaxLife, 0)
    m.setU8(pbChanged >>> 0, 1)
  }
  if (STATES_PurgeExpStateStatLists_6FCDC920_113c(m, pUnit >>> 0) !== 0) {
    m.setU8(pbChanged >>> 0, 1)
  }
  const pPoisonList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 2) >>> 0
  if (pPoisonList !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pPoisonList)
    STATLIST_FreeStatListIfNonExtended113c(m, pPoisonList)
    m.setU8(pbChanged >>> 0, 1)
  }
  const pFreezeList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 1) >>> 0
  if (pFreezeList !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pFreezeList)
    STATLIST_FreeStatListIfNonExtended113c(m, pFreezeList)
    m.setU8(pbChanged >>> 0, 1)
  }
}

/**
 * Deducts `nCost` from `pUnit`'s inventory gold (`STAT_GOLD = 14`) and overflow from stash gold (`STAT_GOLDBANK = 15`).
 * @va D2Game:0x6FCDCC60
 */
export function NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nCost: number,
): number {
  hitD2GameVa113c(0x6FCDCC60)
  const nInvGold = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0e, 0) | 0
  const nStashGold = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0f, 0) | 0
  const cost = nCost | 0
  if (((nStashGold + nInvGold) | 0) < cost) {
    return 0
  }
  if (cost <= nInvGold) {
    const negCost = -cost | 0
    if (pUnit === 0) return 1
    const nextInv = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0e, 0) + negCost) | 0
    if (
      nextInv < 0 ||
      ((m.u32(pUnit >>> 0) >>> 0) === 0 &&
        nextInv > (STATLIST_GetUnitGoldBankLimit113c(m, pUnit >>> 0) | 0))
    ) {
      STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0e, 0, 0)
      return 1
    }
    STATLIST_AddUnitStatMemPort113c(m, pUnit >>> 0, 0x0e, negCost, 0)
    return 1
  }
  const negInv = -nInvGold | 0
  if (pUnit !== 0) {
    const nextInv = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0e, 0) + negInv) | 0
    if (nextInv < 0) {
      STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0e, 0, 0)
    } else if (
      (m.u32(pUnit >>> 0) >>> 0) === 0 &&
      nextInv > (STATLIST_GetUnitGoldBankLimit113c(m, pUnit >>> 0) | 0)
    ) {
      STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0e, 0, 0)
    } else {
      STATLIST_AddUnitStatMemPort113c(m, pUnit >>> 0, 0x0e, negInv, 0)
    }
  }
  const negStashDelta = (nInvGold - cost) | 0
  if (pUnit !== 0) {
    const nextStash = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0f, 0) + negStashDelta) | 0
    if (
      nextStash < 0 ||
      ((m.u32(pUnit >>> 0) >>> 0) === 0 && nextStash > (UNITS_GetStashGoldLimit113c(pUnit >>> 0) | 0))
    ) {
      STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0f, 0, 0)
      return 1
    }
    STATLIST_AddUnitStatMemPort113c(m, pUnit >>> 0, 0x0f, negStashDelta, 0)
  }
  return 1
}

/**
 * Transfers all items from `pSrcInventory` into `pDestUnit->pInventory` (`+0x60`), setting `dwFlagEx |= 4`
 * and socketed command flag `1` when sub-inventory item count > 0.
 * @va D2Game:0x6FCDCD90
 */
export function NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(
  m: D2KernMemory113c,
  pSrcInventory: number,
  pDestUnit: number,
): void {
  hitD2GameVa113c(0x6FCDCD90)
  let pNode = INVENTORY_GetFirstItem113c(m, pSrcInventory >>> 0) >>> 0
  while (pNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    if (pItem !== 0) {
      const flagsC8 = (m.u32((pItem + 0xc8) >>> 0) | 0x04) >>> 0
      const dwType = m.u32(pItem) >>> 0
      m.setU32((pItem + 0xc8) >>> 0, flagsC8)
      if (dwType === 4 && ITEMS_GetSubTypeFromItem113c(m, pItem) !== 0) {
        const pSubInv = m.u32((pItem + 0x60) >>> 0) >>> 0
        if (pSubInv !== 0 && (INVENTORY_GetItemCount113c(m, pSubInv) >>> 0) > 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
        }
      }
    }
    const pDestInv = m.u32((pDestUnit + 0x60) >>> 0) >>> 0
    INVENTORY_AppendItemGuidNode113c(m, pDestInv, pItem)
  }
}

/**
 * Marks `pItem` with command flag `0x10` and optionally appends it to `pNpcUnit->pInventory` (`+0x60`).
 * @va D2Game:0x6FCDCE60
 */
export function NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(
  m: D2KernMemory113c,
  pItem: number,
  pNpcUnit: number,
  bAppendToNpcInv: number,
): void {
  hitD2GameVa113c(0x6FCDCE60)
  ITEMS_SetOrClearCommandFlags113c(m, pItem >>> 0, 0x10, 1)
  if (bAppendToNpcInv === 0) return
  if (pItem !== 0) {
    const flagsC8 = (m.u32((pItem + 0xc8) >>> 0) | 0x04) >>> 0
    const dwType = m.u32(pItem >>> 0) >>> 0
    m.setU32((pItem + 0xc8) >>> 0, flagsC8)
    if (dwType === 4 && ITEMS_GetSubTypeFromItem113c(m, pItem >>> 0) !== 0) {
      const pSubInv = m.u32((pItem + 0x60) >>> 0) >>> 0
      if (pSubInv !== 0 && (INVENTORY_GetItemCount113c(m, pSubInv) >>> 0) > 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pItem >>> 0, 1, 1)
      }
    }
  }
  UNITS_SetUnitUpdateFlags113c(m, pNpcUnit >>> 0, 1)
  const pNpcInv = m.u32((pNpcUnit + 0x60) >>> 0) >>> 0
  INVENTORY_AppendItemGuidNode113c(m, pNpcInv, pItem >>> 0)
}

/**
 * Allocates and populates the `0x450`-byte hireling roster at `pNpcSlot+0x10` and marks up to 10 random entries active.
 * @va D2Game:0x6FCDCED0
 */
export function NPC_InitHirelingVendorRoster_6FCDCED0_113c(
  m: D2KernMemory113c,
  pNpcSlot: number,
  pGame: number,
  nSellerClassId: number,
): void {
  hitD2GameVa113c(0x6FCDCED0)
  if (m.u8((pNpcSlot + 0x21) >>> 0) !== 0) return
  const prevRoster = m.u32((pNpcSlot + 0x10) >>> 0) >>> 0
  m.setU8((pNpcSlot + 0x21) >>> 0, 1)
  if (prevRoster !== 0) return
  const pRoster = m.alloc(0x450) >>> 0
  m.setU32((pNpcSlot + 0x10) >>> 0, pRoster)
  const bExpansion = m.u32((pGame + 0x70) >>> 0)
  const pSeed = (m.u32((pGame + 0x1d24) >>> 0) + 0x08) >>> 0
  const pHirelingTxt =
    DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c(m, bExpansion, nSellerClassId, 0, 0) >>> 0
  if (pHirelingTxt === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x75)
  }
  const wNameFirst = m.u16((pHirelingTxt + 0x114) >>> 0)
  const wNameLast = m.u16((pHirelingTxt + 0x116) >>> 0)
  const nTotal = ((wNameLast - wNameFirst) + 1) | 0
  if (nTotal === -1) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x5b)
  }
  if ((wNameFirst | 0) <= (wNameLast | 0)) {
    for (let i = 0; i < nTotal && ((i + wNameFirst) | 0) <= (wNameLast | 0); i = (i + 1) | 0) {
      const pEntry = (pRoster + ((i << 4) >>> 0)) >>> 0
      m.setU16(pEntry, (wNameFirst + i) & 0xffff)
      const prod = BigInt(m.u32(pSeed)) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0))
      const nextLo = Number(prod & 0xffffffffn) >>> 0
      const nextHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
      m.setU32((pSeed + 0x04) >>> 0, nextHi)
      m.setU32(pSeed, nextLo)
      m.setU32((pEntry + 0x04) >>> 0, nextLo)
      m.setU32((pEntry + 0x08) >>> 0, 0)
      m.setU32((pEntry + 0x0c) >>> 0, 0)
    }
  }
  let picked = 0
  while (picked < 10) {
    const seedObj = { lo: m.u32(pSeed), hi: m.u32((pSeed + 0x04) >>> 0) }
    const startIdx = seedRoll(seedObj, nTotal) | 0
    m.setU32(pSeed, seedObj.lo)
    m.setU32((pSeed + 0x04) >>> 0, seedObj.hi)
    let curIdx = startIdx
    while (true) {
      const pEntry = (pRoster + ((curIdx << 4) >>> 0)) >>> 0
      if (m.u32((pEntry + 0x0c) >>> 0) === 0 && m.u32((pEntry + 0x08) >>> 0) === 0) {
        m.setU32((pEntry + 0x0c) >>> 0, 1)
        picked = (picked + 1) | 0
        break
      }
      curIdx = (curIdx + 1) | 0
      if (curIdx >= nTotal) curIdx = 0
      if (curIdx === startIdx) return
    }
  }
}

/**
 * Rolls exceptional (`dwUberCode`) or elite (`dwUltraCode`) item upgrade in expansion NPC stores.
 * @va D2Game:0x6FCDD040
 */
export function NPC_RollStoreItemUpgrade_6FCDD040_113c(
  m: D2KernMemory113c,
  nIlvl: number,
  pGame: number,
  nItemId: number,
  nNormUpgradeFactor: number,
  nUberUpgradeFactor: number,
): number {
  hitD2GameVa113c(0x6FCDD040)
  if (m.u32((pGame + 0x70) >>> 0) === 0) return nItemId | 0
  const sp = k2W5B4StackPtr
  k2W5B4StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
    if (pItemsTxt === 0) return nItemId | 0
    const pSeed = (m.u32((pGame + 0x1d24) >>> 0) + 0x08) >>> 0
    const dwUltraCodeSaved = m.u32((pItemsTxt + 0x8c) >>> 0) >>> 0
    const dwUberCode = m.u32((pItemsTxt + 0x88) >>> 0) >>> 0
    if (dwUberCode === 0x20202020 || dwUberCode === 0) return nItemId | 0
    const pUberTxt = DATATBLS_GetItemsTxtRecordByCode113c(m, dwUberCode, sp) >>> 0
    if (pUberTxt === 0) return nItemId | 0
    const nUberLvl = m.u8((pUberTxt + 0xfd) >>> 0)
    const nUberChance = (imul32((nIlvl - nUberLvl) | 0, nNormUpgradeFactor | 0) + 1) | 0
    if (nUberChance <= 0) return nItemId | 0
    if ((SEED_RollLimitedFast113c(m, pSeed, 0x2710) | 0) < nUberChance) {
      return m.u32(sp) | 0
    }
    const dwUltraCode = m.u32((pItemsTxt + 0x8c) >>> 0) >>> 0
    if (dwUltraCode !== 0x20202020 && dwUltraCode !== 0) {
      const pUltraTxt =
        DATATBLS_GetItemsTxtRecordByCode113c(m, dwUltraCodeSaved, (sp + 0x04) >>> 0) >>> 0
      if (pUltraTxt !== 0) {
        const nUltraLvl = m.u8((pUltraTxt + 0xfd) >>> 0)
        const nUltraChance = (imul32((nIlvl - nUltraLvl) | 0, nUberUpgradeFactor | 0) + 1) | 0
        if (nUltraChance > 0 && (SEED_RollLimitedFast113c(m, pSeed, 0x2710) | 0) < nUltraChance) {
          return m.u32((sp + 0x04) >>> 0) | 0
        }
      }
    }
    return nItemId | 0
  } finally {
    k2W5B4StackPtr = sp
  }
}

/** `D2Game.dll` `.data` `0x6FD25950`: 7 Tal Rasha tomb symbol object class IDs. */
export const D2GAME_TAL_RASHA_TOMB_OBJECTS_VA_113C = 0x6fd25950

/**
 * Decrements charges on `pUnit`'s highest-level skill `nSkillId`, clears right-hand assignment when
 * charges reach 0, and sends packet `0x22`.
 * @va D2Game:0x6FCDF8F0
 */
export function QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  nConsumeCount: number,
): void {
  hitD2GameVa113c(0x6FCDF8F0)
  if ((nSkillId | 0) < 0) return
  const pSkill =
    SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit >>> 0, nSkillId | 0) >>> 0
  if (pSkill === 0) return
  const curCharges = SKILLS_GetCharges113c(m, pSkill) | 0
  let remCharges = (curCharges - (nConsumeCount | 0)) | 0
  if (remCharges <= 0) {
    if ((UNITS_GetRightSkill113c(m, pUnit >>> 0) >>> 0) === pSkill) {
      SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit >>> 0, 0, 0, 0xffffffff)
    }
    remCharges = 0
  }
  SKILLS_SetCharges113c(m, pSkill, remCharges)
  if (pUnit === 0) {
    NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
      m,
      0,
      6,
      0xffffffff,
      nSkillId & 0xffff,
      remCharges & 0xff,
    )
    return
  }
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  if (dwUnitType !== 0) {
    NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
      m,
      0,
      dwUnitType & 0xff,
      dwUnitGuid,
      nSkillId & 0xffff,
      remCharges & 0xff,
    )
    return
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
    m,
    pClient,
    dwUnitType & 0xff,
    dwUnitGuid,
    nSkillId & 0xffff,
    remCharges & 0xff,
  )
}

/**
 * Updates Act 2 Quest 6 (`0x0D`) extended state (`+0x10`, `+0x14`) when active and not yet finalized.
 * @va D2Game:0x6FCE1990
 */
export function ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c(
  m: D2KernMemory113c,
  pQuestSrc: number,
  bClearOverride: number,
): void {
  hitD2GameVa113c(0x6FCE1990)
  const pGame = m.u32((pQuestSrc + 0x04) >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestEx + 0x0e) >>> 0) === 1) return
  if ((bClearOverride & 0xff) !== 0) {
    m.setU8((pQuestEx + 0x10) >>> 0, 0)
    return
  }
  const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  m.setU8((pQuestEx + 0x10) >>> 0, 1)
  if (m.u8((pQuestGame + 0x6a) >>> 0) === 3) {
    m.setU32((pQuestEx + 0x14) >>> 0, 8)
  } else {
    m.setU32((pQuestEx + 0x14) >>> 0, 9)
  }
}

/**
 * Populates the 6 non-boss Tal Rasha tomb symbol object IDs (`0x6FD25950`) and cycles the next ID.
 * @va D2Game:0x6FCE1BA0
 */
export function ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FCE1BA0)
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pAct2 = m.u32((pGame + 0xc0) >>> 0) >>> 0
  const nBossTombLevel = DRLGLOGIC_GetBossTombLevel113c(m, pAct2) | 0
  if (nBossTombLevel === 0) return 0x133
  const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const nBossIdx = (nBossTombLevel - 0x42) | 0
  if (m.u8((pQuestEx + 0x38) >>> 0) === 0) {
    m.setU8((pQuestEx + 0x38) >>> 0, 1)
    let outCount = 0
    let idx = 0
    let pOut = (pQuestEx + 0x48) >>> 0
    for (let rem = 7; rem !== 0; rem = (rem - 1) | 0) {
      if (idx === nBossIdx) {
        idx = (idx + 1) | 0
      } else if (idx < 7 && outCount < 6) {
        m.setU32(pOut, m.u32((D2GAME_TAL_RASHA_TOMB_OBJECTS_VA_113C + (idx << 2)) >>> 0))
        outCount = (outCount + 1) | 0
        pOut = (pOut + 0x04) >>> 0
        idx = (idx + 1) | 0
      }
    }
  }
  if (m.u16((pQuestEx + 0x3a) >>> 0) === 6) {
    m.setU16((pQuestEx + 0x3a) >>> 0, 0)
  }
  const slot = m.u16((pQuestEx + 0x3a) >>> 0)
  const result = m.u32((pQuestEx + 0x48 + (slot << 2)) >>> 0) >>> 0
  m.setU16((pQuestEx + 0x3a) >>> 0, (slot + 1) & 0xffff)
  return result
}

/**
 * Act 2 Quest 6 (`0x0E`) NPC active dialog filter callback (`pfActiveFilter`).
 * @va D2Game:0x6FCE1C20
 */
export function ACT2Q6_ActiveFilter_6FCE1C20_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE1C20)
  const npcId = nNpcId | 0
  if (npcId === 0xc9) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 0) === 1) return 0
    if (m.u8((pQuestData + 0x0c) >>> 0) === 1) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 3) === 0) {
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 4) === 0) return 1
      }
    }
    return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 3) === 1 ? 1 : 0
  }
  if (npcId === 0xd2) {
    return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 4) === 1 ? 1 : 0
  }
  if (npcId === 0xfb) {
    if (m.u8((pQuestData + 0x09) >>> 0) !== 1) return 0
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    if (m.u8((pQuestEx + 0x01) >>> 0) !== 1) return 0
    return m.u8((pQuestEx + 0x0f) >>> 0) === 0 ? 1 : 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 0x0d) === 0) return 0
  let stateBit = 0
  if (npcId === 0xb0) stateBit = 6
  else if (npcId === 0xaf) stateBit = 7
  else if (npcId === 0xb1) stateBit = 8
  else if (npcId === 0xca) stateBit = 9
  else if (npcId === 0xf4) stateBit = 0x0a
  else if (npcId === 0xb2) stateBit = 0x0b
  else return 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, stateBit) === 0 ? 1 : 0
}

/**
 * Act 2 Quest 6 (`0x0E`) quest log status filter callback (`pfStatusFilter`).
 * @va D2Game:0x6FCE1D30
 */
export function ACT2Q6_StatusFilter_6FCE1D30_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  pQuestFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FCE1D30)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 7, 0) === 0) {
    m.setU8(pOutStatus >>> 0, 0)
    return 1
  }
  const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestEx + 0x10) >>> 0) !== 0) {
    m.setU8(pOutStatus >>> 0, m.u8((pQuestEx + 0x14) >>> 0))
    return 1
  }
  m.setU8(pOutStatus >>> 0, 0)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 0) !== 0) return 1
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 3) === 1) {
    m.setU8(pOutStatus >>> 0, 5)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 4) === 1) {
    m.setU8(pOutStatus >>> 0, 6)
    return 1
  }
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return 1
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 5) === 1) {
    m.setU8(pOutStatus >>> 0, m.u8((pQuestData + 0x0b) >>> 0))
    return 1
  }
  if (m.u8((pQuestData + 0x0c) >>> 0) < 3) {
    m.setU8(pOutStatus >>> 0, m.u8((pQuestData + 0x0b) >>> 0))
    return 1
  }
  m.setU8(pOutStatus >>> 0, 0x0c)
  return 1
}

/** Optional callback hooks for indirect quest sequence filter (`+0xF0`) dispatch. */
export interface K2W5B4Hooks113c {
  readonly invokeQuestSeqFilter?: (
    m: D2KernMemory113c,
    pRefQuest: number,
    fnVa: number,
  ) => number
}

function dispatchQuestSeqFilterF0_113c(
  m: D2KernMemory113c,
  pRefQuest: number,
  hooks?: K2W5B4Hooks113c,
): number {
  const fnVa = m.u32((pRefQuest + 0xf0) >>> 0) >>> 0
  if (hooks !== undefined && hooks.invokeQuestSeqFilter !== undefined) {
    return hooks.invokeQuestSeqFilter(m, pRefQuest, fnVa) & 0xff
  }
  if (fnVa === 0x6fce1ff0) {
    return ACT2Q4_ChainSeqFilter_6FCE1FF0_113c(m, pRefQuest, hooks) & 0xff
  }
  if (fnVa === 0x6fce21e0) {
    return ACT2Q3_SeqFilter_6FCE21E0_113c(m, pRefQuest, hooks) & 0xff
  }
  if (fnVa === 0x6fce24a0) {
    return ACT2Q1_SeqFilter_6FCE24A0_113c(m, pRefQuest, hooks) & 0xff
  }
  return fnVa !== 0 ? 1 : 0
}

/**
 * Act 2 Quest 5 (`0x0D`) NPC active dialog filter callback (`pfActiveFilter`).
 * @va D2Game:0x6FCE1E10
 */
export function ACT2Q5_ActiveFilter_6FCE1E10_113c(
  m: D2KernMemory113c,
  _pQuestData: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE1E10)
  const npcId = nNpcId | 0
  if (
    npcId === 0xb0 ||
    npcId === 0xaf ||
    npcId === 0xc7 ||
    npcId === 0xb1 ||
    npcId === 0xca ||
    npcId === 0xf4 ||
    npcId === 0xd2 ||
    npcId === 0xc9 ||
    npcId === 0xc8 ||
    npcId === 0xb2
  ) {
    return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0d, 1) === 1 ? 1 : 0
  }
  return 0
}

/**
 * Chains `pQuestData` (`edi`) sequence filter evaluation to `pQuestData->nSeqFilterQuestId` (`+0x10`) `pfSeqFilter`.
 * @va D2Game:0x6FCE1FF0
 */
export function ACT2Q4_ChainSeqFilter_6FCE1FF0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  hooks?: K2W5B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FCE1FF0)
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) return 0
  if ((m.u32((pQuestData + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x34e)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 2 Quest 4 (`0x0C`) NPC active dialog filter callback (`pfActiveFilter`).
 * @va D2Game:0x6FCE2080
 */
export function ACT2Q4_ActiveFilter_6FCE2080_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE2080)
  const npcId = nNpcId | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0c, 0) === 1) return 0
  if (npcId === 0x14b) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0c, 1) === 1) return 0
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    const wState40 = m.u16((pQuestEx + 0x40) >>> 0)
    let stateBit = 0
    if (wState40 === 0) {
      stateBit = 7
    } else if (wState40 === 2) {
      if (m.u8((pQuestEx + 0x46) >>> 0) === 0) return 0
      stateBit = 8
    } else {
      return 0
    }
    return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0c, stateBit) === 0 ? 1 : 0
  }
  if (npcId === 0xb1) {
    if (m.u8((pQuestData + 0x0c) >>> 0) !== 1) return 0
  } else if (npcId === 0xc9) {
    if (m.u8((pQuestData + 0x0c) >>> 0) !== 2) return 0
  } else {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0c, 1) !== 0) return 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0c, 0) === 0 ? 1 : 0
}

/**
 * Act 2 Quest 3 (`Tainted Sun`) sequence filter callback (`pfSeqFilter`, `ecx = pQuestData`).
 * @va D2Game:0x6FCE21E0
 */
export function ACT2Q3_SeqFilter_6FCE21E0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  hooks?: K2W5B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FCE21E0)
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) return 0
  if ((m.u32((pQuestData + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2a5)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 2 Quest 3 (`Tainted Sun`) NPC active dialog filter callback (`pfActiveFilter`).
 * @va D2Game:0x6FCE2250
 */
export function ACT2Q3_ActiveFilter_6FCE2250_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE2250)
  const npcId = nNpcId | 0
  const nQuestNo = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, nQuestNo, 0) === 1) return 0
  const nQuestNo2 = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, nQuestNo2, 1) === 1) {
    if (
      npcId === 0xb0 ||
      npcId === 0xaf ||
      npcId === 0xc6 ||
      npcId === 0xc7 ||
      npcId === 0xb1 ||
      npcId === 0xca ||
      npcId === 0xf4 ||
      npcId === 0xd2 ||
      npcId === 0xc8 ||
      npcId === 0xc9
    ) {
      return 1
    }
  }
  if (npcId === 0xb1 && m.u8((pQuestData + 0x0c) >>> 0) === 1) {
    return 1
  }
  return 0
}

/**
 * Act 2 Quest 1 (`Radament's Lair`) sequence filter callback (`pfSeqFilter`, `ecx = pQuestData`).
 * @va D2Game:0x6FCE24A0
 */
export function ACT2Q1_SeqFilter_6FCE24A0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  hooks?: K2W5B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FCE24A0)
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) return 0
  if ((m.u32((pQuestData + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x243)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 2 Quest 1 (`Radament's Lair`) NPC active dialog filter callback (`pfActiveFilter`).
 * @va D2Game:0x6FCE2520
 */
export function ACT2Q1_ActiveFilter_6FCE2520_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE2520)
  if ((nNpcId | 0) !== 0xb0) return 0
  const nQuestNo = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, nQuestNo, 0) === 1) return 0
  if (m.u8((pQuestData + 0x09) >>> 0) !== 0 && m.u8((pQuestData + 0x0c) >>> 0) === 1) {
    const nQuestNo2 = m.u32((pQuestData + 0xe0) >>> 0) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, nQuestNo2, 0x0f) === 0) {
      return 1
    }
  }
  const nQuestNo3 = m.u32((pQuestData + 0xe0) >>> 0) | 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, nQuestNo3, 1) === 1 ? 1 : 0
}

/**
 * Act 2 Palace Guard (`0x17A`) NPC active dialog filter callback (`pfActiveFilter`).
 * @va D2Game:0x6FCE25F0
 */
export function ACT2Q8_ActiveFilter_6FCE25F0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcId: number,
  pPlayer: number,
  _pQuestFlags = 0,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE25F0)
  if ((nNpcId | 0) !== 0x17a) return 0
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pPlayerQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestControl = m.u32((pGame2 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return 0
  if (m.u8((pQuest + 0x0c) >>> 0) >= 2) return 0
  if (QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame2, 0x0b, 0x0d) === 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pPlayerQuestFlags, 0x0e, 1) !== 0) return 0
  return DRLGWARP_TestRoomTileBit113c(m, pPlayerQuestFlags, 0x0e, 0) === 0 ? 1 : 0
}

/**
 * Act 2 Palace Guard (`0x17A`) NPC activate callback (`pfCallback[0]`).
 * @va D2Game:0x6FCE2680
 */
export function ACT2Q8_Callback00_NpcActivate_6FCE2680_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2680)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) >>> 0 : 0xffffffff
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pPlayerQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if ((nNpcClassId | 0) !== 0x17a) return
  const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestControl = m.u32((pGame2 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0c) >>> 0) >= 2) return
  if ((ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame2) & 0xff) !== 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pPlayerQuestFlags, 0x0e, 1) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pPlayerQuestFlags, 0x0e, 0) !== 0) return
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData >>> 0,
    0,
    m.u32((pQuestArg + 0x14) >>> 0),
    0x17a,
  )
}

/**
 * Initializes the Arcane Sanctuary portal object (`ACT2Q5`), recording its GUID at `pQuestEx+0x28`
 * and setting its animation mode to `2` or `0`.
 * @va D2Game:0x6FCE2850
 */
export function ACT2Q5_InitArcanePortalObject_6FCE2850_113c(
  m: D2KernMemory113c,
  pOpData: number,
): void {
  hitD2GameVa113c(0x6FCE2850)
  const pGame = m.u32(pOpData >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = 0
  if (pQuestControl !== 0) {
    pQuest = m.u32(pQuestControl) >>> 0
    while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }
  if (pQuest === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pOpData + 0x04) >>> 0), 2)
    return
  }
  const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestEx + 0x06) >>> 0, 1)
  const pObj = m.u32((pOpData + 0x04) >>> 0) >>> 0
  const dwObjGuid = pObj !== 0 ? m.u32((pObj + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32((pQuestEx + 0x28) >>> 0, dwObjGuid)
  if (
    m.u8((pQuest + 0x09) >>> 0) === 0 ||
    m.u8((pQuestEx + 0x0b) >>> 0) === 1 ||
    m.u8((pQuestEx + 0x0d) >>> 0) === 1
  ) {
    UNITS_ChangeAnimMode113c(m, m.u32((pOpData + 0x04) >>> 0), 2)
    return
  }
  UNITS_ChangeAnimMode113c(m, m.u32((pOpData + 0x04) >>> 0), 0)
}

/** `D2Game.dll` `.data` `0x6FD25938`: Act 2 Quest 6 sequence-state -> dialog message index table. */
export const D2GAME_ACT2Q6_SEQ_MSG_TABLE_VA_113C = 0x6fd25938

/**
 * Act 2 Quest 6 player quest-flag sync callback (`pfCallback[0x11]`).
 * @va D2Game:0x6FCE2900
 */
export function ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2900)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 9)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) !== 0) {
    m.setU8((m.u32((pQuestData + 0x18) >>> 0) + 0x0c) >>> 0, 1)
    m.setU8((m.u32((pQuestData + 0x18) >>> 0) + 0x0d) >>> 0, 1)
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuestData + 0xe0) >>> 0) | 0, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuestData + 0xe0) >>> 0) | 0, 0x0f) !== 0
  ) {
    m.setU8((m.u32((pQuestData + 0x18) >>> 0) + 0x3d) >>> 0, 1)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 2) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 5)
    m.setU8((pQuestData + 0x0c) >>> 0, 5)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 6)
    m.setU8((pQuestData + 0x0c) >>> 0, 5)
  }
}

/**
 * Sets quest state `(0x0E, 5)` on players currently in Act 2 who have not advanced Act 2 Quest 6.
 * @va D2Game:0x6FCE29E0
 */
export function ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FCE29E0)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 5) === 1) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 5)
  }
}

/**
 * Act 2 Quest 6 (`Seven Tombs`) NPC activate callback (`pfCallback[0]`).
 * @va D2Game:0x6FCE2B00
 */
export function ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2B00)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  let nNpcId = 0xffffffff
  if (pNpc !== 0) {
    nNpcId = m.u32((pNpc + 0x04) >>> 0) >>> 0
    if ((nNpcId | 0) === 0xfb) {
      const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
      if ((m.u32((pQuestEx + 0x18) >>> 0) | 0) !== 2) return
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData >>> 0,
        2,
        m.u32((pQuestArg + 0x14) >>> 0),
        0xfb,
      )
      return
    }
  }
  const npcSigned = nNpcId | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d) !== 0) {
    let congratsBit = 0
    if (npcSigned === 0xb0) congratsBit = 6
    else if (npcSigned === 0xaf) congratsBit = 7
    else if (npcSigned === 0xb1) congratsBit = 8
    else if (npcSigned === 0xca) congratsBit = 9
    else if (npcSigned === 0xf4) congratsBit = 0x0a
    else if (npcSigned === 0xb2) congratsBit = 0x0b
    if (congratsBit !== 0 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, congratsBit) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData >>> 0,
        6,
        m.u32((pQuestArg + 0x14) >>> 0),
        npcSigned,
      )
      return
    }
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData >>> 0,
      3,
      m.u32((pQuestArg + 0x14) >>> 0),
      npcSigned,
    )
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) !== 0) {
    const msgIdx = npcSigned === 0xd2 ? 5 : 4
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData >>> 0,
      msgIdx,
      m.u32((pQuestArg + 0x14) >>> 0),
      npcSigned,
    )
    return
  }
  const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer2 !== 0 ? m.u32((pPlayer2 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  if (QUESTS_HasPlayerGuidInQuest113c(m, pQuestData >>> 0, dwPlayerGuid) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData >>> 0,
      4,
      m.u32((pQuestArg + 0x14) >>> 0),
      npcSigned,
    )
    return
  }
  if (m.u8((pQuestData + 0x0c) >>> 0) === 0) return
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0)
  const bitD = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d)
  if (bit0 === 1 && bitD === 0) return
  const bSeq = m.u8((pQuestData + 0x0c) >>> 0)
  if (bSeq >= 4 && bitD === 0) return
  const msgIdx = m.u32((D2GAME_ACT2Q6_SEQ_MSG_TABLE_VA_113C + (bSeq << 2)) >>> 0) >>> 0
  if (msgIdx === 1 && npcSigned === 0xb1) {
    if (QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32((pQuestData + 0x04) >>> 0), 0x0c, 0x0d) === 1) {
      return
    }
  } else if (msgIdx === 0xffffffff || msgIdx >= 8) {
    return
  }
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData >>> 0,
    msgIdx | 0,
    m.u32((pQuestArg + 0x14) >>> 0),
    npcSigned,
  )
}

/**
 * Sets quest states `(0x0D, 0x0D)` and `(0x0D, 1)` on Act 2 players when quest `0x0C` completes.
 * @va D2Game:0x6FCE2E70
 */
export function ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FCE2E70)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0c) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) === 1) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 0x0d)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 1)
  }
}

/**
 * Marks quest `0x0D` states `(0x0D, 0x0D)` and `(0x0D, 1)` for players in or adjacent to the Summoner's room.
 * @va D2Game:0x6FCE2F10
 */
export function ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE2F10)
  const sp = k2W5B4StackPtr
  k2W5B4StackPtr = (sp + 0x08) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
    const pPlayerRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
    if (pPlayerRoom === 0) return 0
    const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    let pQuest = 0
    if (pQuestControl !== 0) {
      pQuest = m.u32(pQuestControl) >>> 0
      while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0c) {
        pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
      }
    }
    if (pQuest === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x10d)
    }
    const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
    let bNear = 0
    if (pPlayerRoom === (m.u32((pQuestEx + 0x04) >>> 0) >>> 0)) {
      bNear = 1
    } else {
      const pRoom2 = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
      if (pRoom2 === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x11c)
      }
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom2, (sp + 0x04) >>> 0, sp)
      const nAdjCount = m.u32(sp) >>> 0
      if (nAdjCount > 0) {
        const pTargetRoom = m.u32((pQuestEx + 0x04) >>> 0) >>> 0
        const ppRooms = m.u32((sp + 0x04) >>> 0) >>> 0
        for (let i = 0; (i >>> 0) < nAdjCount; i = (i + 1) | 0) {
          if ((m.u32((ppRooms + (i << 2)) >>> 0) >>> 0) === pTargetRoom) {
            bNear = 1
            break
          }
        }
      }
    }
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) === 0 &&
      bNear !== 0
    ) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 0x0d)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 1)
    }
    return 0
  } finally {
    k2W5B4StackPtr = sp
  }
}

/** `D2Game.dll` `.data` `0x6FD25308`: Act 2 Quest 5 sequence-state -> dialog message index table. */
export const D2GAME_ACT2Q5_SEQ_MSG_TABLE_VA_113C = 0x6fd25308

/**
 * Sets quest state `(0x0D, 2)` on `pPlayer` when quest `0x0C` has `nSeqFilter == 1`.
 * @va D2Game:0x6FCE3010
 */
export function ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE3010)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) === 1) return 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x0c) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 2)
  }
  return 0
}

/**
 * Act 2 Quest 5 (`The Summoner`) NPC activate callback (`pfCallback[0]`).
 * @va D2Game:0x6FCE3080
 */
export function ACT2Q5_Callback00_NpcActivate_6FCE3080_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE3080)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) >>> 0 : 0xffffffff
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData >>> 0,
      1,
      m.u32((pQuestArg + 0x14) >>> 0),
      nNpcId | 0,
    )
    return
  }
  const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer2 !== 0 ? m.u32((pPlayer2 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
  if ((nGuidCount | 0) > 0) {
    let pGuid = (pQuestData + 0x1c) >>> 0
    for (let i = 0; i < (nGuidCount | 0); i = (i + 1) | 0) {
      if ((m.u32(pGuid) >>> 0) === dwPlayerGuid) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData >>> 0,
          2,
          m.u32((pQuestArg + 0x14) >>> 0),
          nNpcId | 0,
        )
        return
      }
      pGuid = (pGuid + 0x04) >>> 0
    }
  }
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  if (m.u8((pQuestData + 0x0c) >>> 0) === 0) return
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0)
  const bitD = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0d)
  if (bit0 === 1 && bitD === 0) return
  const bSeq = m.u8((pQuestData + 0x0c) >>> 0)
  if (bSeq >= 2 && bitD === 0) return
  const msgIdx = m.u32((D2GAME_ACT2Q5_SEQ_MSG_TABLE_VA_113C + (bSeq << 2)) >>> 0) >>> 0
  if (msgIdx === 0xffffffff || msgIdx >= 4) return
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData >>> 0,
    msgIdx | 0,
    m.u32((pQuestArg + 0x14) >>> 0),
    nNpcId | 0,
  )
}

/**
 * Checks whether `pPlayer` is within octile distance `30` (`0x1E`) of Horazon's Journal (`ACT2Q4`)
 * and records `pPlayer`'s GUID on `pQuestEx+0x1C`.
 * @va D2Game:0x6FCE31C0
 */
export function ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE31C0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 1) === 1) return 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = 0
  if (pQuestControl !== 0) {
    pQuest = m.u32(pQuestControl) >>> 0
    while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0b) {
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }
  const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nY = m.u32((pQuestEx + 0x24) >>> 0) | 0
  const nX = m.u32((pQuestEx + 0x20) >>> 0) | 0
  const dist = UNITS_GetOctileDistanceToCoordinates113c(m, pPlayer >>> 0, nX, nY) >>> 0
  if (dist > 0x1e) return 0
  m.setU8((pQuestEx + 0x1a) >>> 0, 1)
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32((pQuestEx + 0x1c) >>> 0, dwPlayerGuid)
  return 1
}

/**
 * Returns `0` when Palace Cellar entry is blocked by incomplete Radament/Horadric Staff/Arcane Sanctuary state, else `1`.
 * @va D2Game:0x6FCE3260
 */
export function ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c(
  m: D2KernMemory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE3260)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 1
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 1
  while ((m.u32(pQuest) | 0) !== 0x0b) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 1
  }
  const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestEx + 0x0d) >>> 0) === 0) return 1
  if ((ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, m.u32((pQuest + 0x04) >>> 0)) & 0xff) !== 0) {
    return 1
  }
  if (
    (ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c(m, m.u32((pQuest + 0x04) >>> 0)) &
      0xff) !==
    0
  ) {
    return 1
  }
  if (m.u8((pQuest + 0x09) >>> 0) !== 1) return 1
  if (m.u8((pQuest + 0x0c) >>> 0) >= 2) return 1
  return 0
}

/**
 * Act 2 Quest 4 (`Arcane Sanctuary`) player quest-flag sync callback (`pfCallback[0x11]`).
 * @va D2Game:0x6FCE3320
 */
export function ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE3320)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0) !== 0) {
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) === 1
  ) {
    const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    const pQuestCtrl = m.u32((pGame2 + 0x10f4) >>> 0) >>> 0
    if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x820)
    }
    QUESTRECORD_SetQuestState113c(m, m.u32((pQuestCtrl + 0x0c) >>> 0), 0x0c, 0x0d)
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
    return
  }
  const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame3 = m.u32(pQuestArg >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer2, pGame3, 0x20747368) !== 0) {
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 1)
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 5) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    m.setU8((pQuestData + 0x0c) >>> 0, 4)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 4) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 3)
    m.setU8((pQuestData + 0x0c) >>> 0, 4)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 3) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 3)
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 2) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 2)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) === 1) {
    m.setU8((pQuestEx + 0x0e) >>> 0, 1)
    m.setU16((pQuestEx + 0x40) >>> 0, 2)
  }
}

/**
 * Completes quest `0x0C` (`ACT2Q4`) for players currently in Act 2 and sets state bits `0x0D, 1, 0, 8, 7`.
 * @va D2Game:0x6FCE3480
 */
export function ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FCE3480)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) === 1) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 1) return
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 0)
  QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestFlags, 0x0c)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 8)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 7)
}

/**
 * Propagates quest `0x0B` (`ACT2Q4`) sequence state (`2..4`) to player quest record `0x0C` states (`2..5`).
 * @va D2Game:0x6FCE3550
 */
export function ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE3550)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) === 1) return 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x0b) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }
  const bSeq = m.u8((pQuest + 0x0c) >>> 0)
  if (bSeq === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 2)
    return 0
  }
  if (bSeq === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 3)
    return 0
  }
  if (bSeq === 4) {
    const bLast = m.u8((pQuest + 0x0b) >>> 0)
    if (bLast === 2 || bLast === 3) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 4)
      return 0
    }
    if (bLast === 4) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 5)
    }
  }
  return 0
}

/**
 * Increments `pQuestEx->nNeedAmuletCount` (`+0x9C`) on quest `0x0A` for players lacking `'vip '`, `'hst '`, and `(0x0A, 0)`.
 * @va D2Game:0x6FCE3630
 */
export function ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE3630)
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20706976) !== 0) {
    return 0
  }
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20747368) !== 0) {
    return 0
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) !== 0) return 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x0a) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }
  const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU32((pQuestEx + 0x9c) >>> 0, (m.u32((pQuestEx + 0x9c) >>> 0) + 1) >>> 0)
  return 0
}

/**
 * Sets quest `0x0B` states `0x0D` and `1` for players on the Claw Viper Altar level (`pQuestEx+0x98`).
 * @va D2Game:0x6FCE36B0
 */
export function ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE36B0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = 0
  if (pQuestControl !== 0) {
    pQuest = m.u32(pQuestControl) >>> 0
    while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0a) {
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }
  if (pRoom !== 0 && pQuest !== 0) {
    const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) >>> 0
    if ((m.u32((pQuestEx + 0x98) >>> 0) >>> 0) === nLevelId) {
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0) !== 1 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0f) !== 1
      ) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 0x0d)
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 1)
      }
    }
  }
  return 0
}

/**
 * Propagates quest `0x0A` (`ACT2Q3`) sequence state (`1..3`) to player quest record `0x0B` states (`2..4`).
 * @va D2Game:0x6FCE3750
 */
export function ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE3750)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 1) === 1) return 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x0a) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }
  if (m.u8((pQuest + 0x0c) >>> 0) >= 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 2)
  }
  const bSeq = m.u8((pQuest + 0x0c) >>> 0)
  if (bSeq === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 3)
  } else if (bSeq === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 4)
  }
  return 0
}

/** `D2Game.dll` `.data` `0x6FD24690`: Act 2 Quest 3 sequence-state -> dialog message index table. */
export const D2GAME_ACT2Q3_SEQ_MSG_TABLE_VA_113C = 0x6fd24690

/**
 * Act 2 Quest 3 (`Tainted Sun`) NPC activate callback (`pfCallback[0]`).
 * @va D2Game:0x6FCE37F0
 */
export function ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE37F0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) >>> 0 : 0xffffffff
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 1) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData >>> 0,
      3,
      m.u32((pQuestArg + 0x14) >>> 0),
      nNpcId | 0,
    )
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0e) !== 0) return
  const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer2 !== 0 ? m.u32((pPlayer2 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
  if ((nGuidCount | 0) > 0) {
    let pGuid = (pQuestData + 0x1c) >>> 0
    for (let i = 0; i < (nGuidCount | 0); i = (i + 1) | 0) {
      if ((m.u32(pGuid) >>> 0) === dwPlayerGuid) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData >>> 0,
          4,
          m.u32((pQuestArg + 0x14) >>> 0),
          nNpcId | 0,
        )
        return
      }
      pGuid = (pGuid + 0x04) >>> 0
    }
  }
  if (m.u8((pQuestData + 0x0c) >>> 0) === 0) return
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuestData + 0xe0) >>> 0) | 0, 0) === 1) {
    return
  }
  const bSeq = m.u8((pQuestData + 0x0c) >>> 0)
  if (bSeq >= 4) return
  const msgIdx = m.u32((D2GAME_ACT2Q3_SEQ_MSG_TABLE_VA_113C + (bSeq << 2)) >>> 0) >>> 0
  if (msgIdx === 0xffffffff || msgIdx >= 6) return
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData >>> 0,
    msgIdx | 0,
    m.u32((pQuestArg + 0x14) >>> 0),
    nNpcId | 0,
  )
}

/**
 * Sets quest `0x0B` states `0x0D` and `1` for players currently in Act 2.
 * @va D2Game:0x6FCE3900
 */
export function ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FCE3900)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 1) === 1) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 0x0d)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 1)
  }
}

/**
 * Tallies Horadric Staff components (`'msf '`, `'vip '`, `'box '`, `'hst '`) on `pQuestEx` and clears
 * quest `0x0D` status override when complete.
 * @va D2Game:0x6FCE39B0
 */
export function ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE39B0)
  const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
      0x2066736d,
    ) !== 0
  ) {
    m.setU32((pQuestEx + 0x18) >>> 0, (m.u32((pQuestEx + 0x18) >>> 0) + 1) >>> 0)
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
      0x20706976,
    ) !== 0
  ) {
    m.setU32((pQuestEx + 0x24) >>> 0, (m.u32((pQuestEx + 0x24) >>> 0) + 1) >>> 0)
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
      0x20786f62,
    ) !== 0
  ) {
    m.setU32((pQuestEx + 0x20) >>> 0, (m.u32((pQuestEx + 0x20) >>> 0) + 1) >>> 0)
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
      0x20747368,
    ) !== 0
  ) {
    m.setU32((pQuestEx + 0x1c) >>> 0, (m.u32((pQuestEx + 0x1c) >>> 0) + 1) >>> 0)
  }
  if (m.u8((pQuestEx + 0x2b) >>> 0) === 0) return
  if ((m.u32((pQuestEx + 0x1c) >>> 0) | 0) <= 0) {
    if (m.u32((pQuestEx + 0x20) >>> 0) === 0) return
    if (m.u32((pQuestEx + 0x24) >>> 0) === 0) return
    if (m.u32((pQuestEx + 0x18) >>> 0) === 0) return
  }
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  const pQuest0DEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuest0DEx + 0x0e) >>> 0) !== 1) {
    m.setU8((pQuest0DEx + 0x10) >>> 0, 0)
  }
}

/**
 * Act 2 Quest 2 (`The Horadric Staff`) player quest-flag & item sync callback (`pfCallback[0x11]`).
 * @va D2Game:0x6FCE3A80
 */
export function ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE3A80)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const hasMsf = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0),
    m.u32(pQuestArg >>> 0),
    0x2066736d,
  )
  const hasBox = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0),
    m.u32(pQuestArg >>> 0),
    0x20786f62,
  )
  const hasVip = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0),
    m.u32(pQuestArg >>> 0),
    0x20706976,
  )
  const hasHst = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0),
    m.u32(pQuestArg >>> 0),
    0x20747368,
  )
  const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (hasMsf !== 0) m.setU32((pQuestEx + 0x18) >>> 0, (m.u32((pQuestEx + 0x18) >>> 0) + 1) >>> 0)
  if (hasVip !== 0) m.setU32((pQuestEx + 0x24) >>> 0, (m.u32((pQuestEx + 0x24) >>> 0) + 1) >>> 0)
  if (hasBox !== 0) m.setU32((pQuestEx + 0x20) >>> 0, (m.u32((pQuestEx + 0x20) >>> 0) + 1) >>> 0)
  if (hasHst !== 0) m.setU32((pQuestEx + 0x1c) >>> 0, (m.u32((pQuestEx + 0x1c) >>> 0) + 1) >>> 0)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) !== 0) return
  const pGame2 = m.u32(pQuestArg >>> 0) >>> 0
  const pQuestControl = m.u32((pGame2 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  const pQuest0DEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuest0DEx + 0x0b) >>> 0) !== 0) return
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, m.u32((pQuestArg + 0x0c) >>> 0), pGame2, 0x20747368) !== 0) {
    return
  }
  if (hasMsf !== 0 && hasBox !== 0 && hasVip !== 0) return
  if (hasMsf === 0) QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 5)
  if (hasBox === 0) QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 6)
  if (hasVip === 0) QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 4)
}

/**
 * Act 2 Quest 2 (`The Horadric Staff`) quest log status filter callback (`pfStatusFilter`).
 * @va D2Game:0x6FCE3BD0
 */
export function ACT2Q2_StatusFilter_6FCE3BD0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pQuestFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FCE3BD0)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 7, 0) === 0) {
    m.setU8(pOutStatus >>> 0, 0)
    return 1
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 1) !== 0
  ) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0e, 0) === 0) {
      const bitA = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 0x0a)
      m.setU8(pOutStatus >>> 0, bitA !== 0 ? 5 : 6)
      return 1
    }
    const bitD = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 0x0d)
    m.setU8(pOutStatus >>> 0, bitD !== 0 ? 0x0d : 0x0b)
    return 1
  }
  m.setU8(pOutStatus >>> 0, 0)
  const hasTr1 = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer >>> 0,
    m.u32((pQuestData + 0x04) >>> 0),
    0x20317274,
  )
  const hasMsf = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer >>> 0,
    m.u32((pQuestData + 0x04) >>> 0),
    0x2066736d,
  )
  const hasBox = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer >>> 0,
    m.u32((pQuestData + 0x04) >>> 0),
    0x20786f62,
  )
  const hasVip = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer >>> 0,
    m.u32((pQuestData + 0x04) >>> 0),
    0x20706976,
  )
  const hasHst = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer >>> 0,
    m.u32((pQuestData + 0x04) >>> 0),
    0x20747368,
  )
  const bit3 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 3)
  if (hasMsf !== 0 && hasBox !== 0 && hasVip !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 6) !== 0) {
      m.setU8(pOutStatus >>> 0, 3)
      return 1
    }
    m.setU8(pOutStatus >>> 0, bit3 === 0 ? 4 : 2)
    return 1
  }
  if (hasHst !== 0) {
    const bitA = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 0x0a)
    m.setU8(pOutStatus >>> 0, bitA !== 0 ? 5 : 6)
    return 1
  }
  if (hasTr1 !== 0 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 3) === 0) {
    m.setU8(pOutStatus >>> 0, 1)
    return 1
  }
  const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (
    (m.u8((pQuestEx + 0x29) >>> 0) !== 0 && m.u32((pQuestEx + 0x20) >>> 0) === 0) ||
    (m.u32((pQuestEx + 0x24) >>> 0) === 0 &&
      (ACT2Q3_GetAltarState_6FCE2120_113c(m, pQuestData >>> 0) & 0xff) !== 0) ||
    (m.u8((pQuestEx + 0x28) >>> 0) !== 0 && m.u32((pQuestEx + 0x18) >>> 0) === 0)
  ) {
    m.setU8(pOutStatus >>> 0, 9)
  }
  if (bit3 !== 0) {
    m.setU8(pOutStatus >>> 0, 2)
    return 1
  }
  if (hasVip !== 0 || hasMsf !== 0 || hasBox !== 0) {
    m.setU8(pOutStatus >>> 0, 4)
    return 1
  }
  return 1
}
