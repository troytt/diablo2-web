/**
 * GameInstance Subsystem: Artisans (Imbue/Sockets/Personalize), Repair, Identify, Merc Hire, NPC Dialog & Vendors (`src/server/engine/game-instance/npc-vendors-and-artisans.ts`).
 */

import { BELT_POTION_CATALOG, areBeltPotionsCompatible } from '../../../common/items/belt-model.ts'
import { decodeStat204ChargedSkill113c } from '../../../common/items/charged-skill.ts'
import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { resolveGambledItem, resolveStorePageForBase } from '../../../common/items/vendor-generator.ts'
import { CURABLE_STATE_IDS_113C } from '../../../common/world/object-operate-113c.ts'
import { findFreePortalCoordNear113c } from '../../world/pandemonium-113c.ts'
import { ANYA_CLASS_REWARD_POOLS_113C, QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_COMPLETED_NOW_113C, QUEST_FLAG_CUSTOM_3_113C, QUEST_FLAG_CUSTOM_4_113C, QUEST_FLAG_CUSTOM_5_113C, QUEST_FLAG_CUSTOM_7_113C, QUEST_FLAG_CUSTOM_8_113C, QUEST_FLAG_CUSTOM_9_113C, QUEST_FLAG_CUSTOM_10_113C, QUEST_FLAG_PRIMARY_GOAL_DONE_113C, QUEST_FLAG_REWARD_PENDING_113C, QUEST_FLAG_STARTED_113C, clearQuestFlag113c, hasQuestFlag113c, questWordIndex113c } from '../quests-113c.ts'
import { createDroppedItem, getMaxSockets113c, imbueItem113c, isEligibleForCharsiImbue113c, resolveAutoPrefixGroup, resolveStaffModsClass, rollAutoMagic, rollStaffMods } from '../../../common/items/drop-tables.ts'
import { isQuestItemBase113c } from '../../../common/items/runeword.ts'
import { CANONICAL_AUTOMAGIC_TABLE } from '../../../common/items/automagic.ts'
import { rollRareAffixes } from '../../../common/items/affix-generator.ts'
import { inferItemClassFromType } from '../../../common/items/affixes.ts'
import { D2Rng } from '../../../common/rng/d2-rng.ts'
import { HIRELING_RECORDS, computeMercHireCost113c, computeMercResurrectCost113c, generateHireCandidates113c } from '../../../common/units/hireling-table.ts'
import { getTownNpcDescriptorByHcIdx } from '../../../common/units/npc-table.ts'
import type { ServerEvent } from '../../../netproto/index.ts'
import { findStandableNear } from '../../world/area-bootstrap.ts'
import { finalizeDroppedItem113c } from '../../items/server-item-data.ts'
import { computeRepairAllCost113c, computeTransactionCost113c, type TransactionCostInput, type TransactionCostTables } from '../../../common/items/transaction-cost.ts'
import { getInventoryGoldLimit, getStashGoldLimit } from '../../../common/items/inventory-model.ts'
import { FIXED_ONE } from '../stat-list.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMonsterRecord, InternalObjectRecord, InternalPlayerRecord, ServerItemEntry } from './types.ts'
import { ACT_TOWN_AREAS, LEGACY_TEST_GRID_SPAWN, NPC_INTRO_BIT_BY_HCIDX_113C, STAT_ITEM_CHARGED_SKILL, TOWN_AREAS, areaToAct, getBaseSizeTable, lookupBaseInfo, toItemContainer, UNIT_TYPE_113C } from './constants-and-helpers.ts'


function handleCursorArtisanService(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  itemId: number,
): boolean {
  const item = player.items.find(
    (candidate) => candidate.unitId === itemId && candidate.location === 'cursor',
  )
  const npc = item && this.resolveServiceNpc(player, npcId)
  if (!item || !npc || !getTownNpcDescriptorByHcIdx(npc.hcIdx)?.questRewardActions?.[0]) {
    return false
  }
  const slot = this.findFreeGridSlot(player, 'inventory', item.width, item.height, 10, 4)
  item.location = 'inventory'
  item.x = slot?.x ?? 0
  item.y = slot?.y ?? 0
  item.storePage = 1
  const rewarded = this.handleArtisanService(player, npcId, itemId)
  if (!rewarded) {
    item.location = 'cursor'
    item.x = 0
    item.y = 0
  }
  if (!rewarded || !slot) this.handleItemDrop(player, itemId)
  this.emitToPlayer(player.unitId, {
    type: 'OpenUi',
    unitType: 1,
    unitId: npcId,
    uiId: rewarded ? 6 : 7,
  })
  return true
}



/** Charsi imbue / Larzuk sockets / Anya personalize (quest reward actions). */
function handleArtisanService(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  itemId: number,
): boolean {
  const npc = this.resolveServiceNpc(player, npcId)
  if (!npc) return false
  const action = getTownNpcDescriptorByHcIdx(npc.hcIdx)?.questRewardActions?.[0]
  if (!action) return false
  const item = player.items.find(
    (candidate) =>
      candidate.unitId === itemId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'equipped' ||
        candidate.location === 'cursor'),
  )
  if (!item) return false
  const resultContainer =
    item.location === 'equipped'
      ? 'equipment'
      : item.location === 'cursor'
        ? 'cursor'
        : 'inventory'
  // 1.13c quest rewards are one-shot: require and consume the completed/pending
  // quest flag for Charsi (a1q5), Larzuk (a5q1) and Anya (a5q4).
  const questId =
    action === 'imbue' ? 'a1q5' : action === 'add_sockets' ? 'a5q1' : 'a5q4'
  const questIndexForReward = questWordIndex113c(questId)
  const questBits =
    questIndexForReward === undefined ? 0 : (player.questFlags[questIndexForReward] ?? 0)
  const hasPendingReward =
    (questBits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 ||
    ((questBits & QUEST_FLAG_COMPLETED_113C) !== 0 &&
      (questBits & QUEST_FLAG_COMPLETED_NOW_113C) === 0)
  if (!hasPendingReward) {
    return false
  }
  if (action === 'imbue') {
    if (
      !isEligibleForCharsiImbue113c(
        {
          code: item.code,
          identified: item.identified,
          quality: item.quality,
          sockets: item.totalSockets,
          socketed: item.socketed,
          socketedItems: item.socketedItems,
          ethereal: item.ethereal,
        },
        getEmbeddedDropTables(),
      )
    ) {
      return false
    }
    const imbued = finalizeDroppedItem113c(imbueItem113c(
      {
        code: item.code,
        identified: item.identified,
        quality: item.quality,
        sockets: item.totalSockets,
        socketed: item.socketed,
        socketedItems: item.socketedItems,
        ethereal: item.ethereal,
        ...(item.rawItemData?.personalized === true
          ? {
              personalized: true,
              personalizedName: item.rawItemData.personalizedName ?? player.name,
            }
          : {}),
      } as never,
      player.level,
      {
        dropTables: getEmbeddedDropTables(),
        rng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
      },
    ) as never)
    const index = player.items.findIndex((candidate) => candidate.unitId === item.unitId)
    const replacement = this.createServerEntryFromItem(imbued as never, {
      location: item.location,
      x: item.x,
      y: item.y,
      areaId: item.areaId,
      ownerId: item.ownerId,
      storePage: item.storePage,
      gamble: false,
    })
    replacement.unitId = item.unitId
    replacement.bodyLoc = item.bodyLoc
    replacement.quality = 6
    if (replacement.rawItemData !== undefined) {
      replacement.rawItemData = {
        ...replacement.rawItemData,
        id: item.unitId,
        itemId: item.unitId,
      }
    }
    if (index !== -1) player.items[index] = replacement
    const malus = player.items.find(
      (candidate) => candidate.code.trim().toLowerCase() === 'hdm',
    )
    if (malus !== undefined) {
      this.removePlayerQuestItem(player, malus)
    }
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action,
      itemId: replacement.unitId,
      code: replacement.code,
      x: replacement.x,
      y: replacement.y,
      container: resultContainer,
      item: this.serverEntryToItemData(replacement),
    })
  } else if (action === 'add_sockets') {
    const trimmedCode = item.code.trim().toLowerCase()
    const rawFlags = Number(item.rawItemData?.rawFlags ?? item.rawItemData?.flags ?? 0)
    if (
      item.socketed ||
      item.totalSockets > 0 ||
      item.socketedItems.length > 0 ||
      item.rawItemData?.socketed === true ||
      (rawFlags & 0x0800) !== 0
    ) {
      return false
    }
    // 1.13c D2Game.dll 0x6FCE0630..0x6FCE06D4 -> D2Common #11151 (0x6FD74610):
    // Reject player ears (IFLAG_ISEAR 0x1000 / 'ear'), broken items (IFLAG_BROKEN 0x0100),
    // Low Quality (quality === 1 Cracked/Crude/Damaged), stackables, non-socketable bases,
    // and quest items (`ItemsTxt.nQuest != 0` except Wirt's Leg `'leg'`) without consuming A5Q1 (#1917).
    if (trimmedCode === 'ear' || item.rawItemData?.isEar === true || (rawFlags & 0x1000) !== 0) {
      return false
    }
    if (
      item.rawItemData?.broken === true ||
      (rawFlags & 0x0100) !== 0 ||
      (item.maxDurability > 0 && item.durability <= 0)
    ) {
      return false
    }
    const qualityCode = this.normalizeItemQualityCode113c(
      item.rawItemData?.quality ?? item.quality,
    )
    if (qualityCode === 1) return false
    const tables = getEmbeddedDropTables()
    const base = tables.getBase(item.code) as
      | (Record<string, unknown> & {
          type?: string
          gemsockets?: number
          stackable?: boolean
          quest?: number | boolean
        })
      | undefined
    const baseInfo = lookupBaseInfo(trimmedCode)
    if (base?.stackable === true || baseInfo.stackable) return false
    if (
      trimmedCode !== 'leg' &&
      (Number(base?.quest ?? 0) !== 0 || base?.quest === true || baseInfo.quest || this.isOnePerPlayerQuestItem(trimmedCode))
    ) {
      return false
    }
    const typeDef = base?.type !== undefined ? tables.itemTypes.byCode.get(String(base.type)) : undefined
    const maxSockets = getMaxSockets113c(base, typeDef, item.level)
    if (maxSockets <= 0) return false
    let sockets: number
    if (qualityCode <= 3) {
      sockets = maxSockets
    } else if (qualityCode === 4) {
      // 1.13c 0x6FCE06AB..0x6FCE06D0: magic items roll 1..min(maxSockets, 2) using ITEMS_GetSeed(pItem)
      const rawSeed =
        item.seed ??
        item.rawItemData?.guid ??
        (
          item.rawItemData as
            | { readonly dwInitSeed?: number; readonly seed?: number }
            | undefined
        )?.dwInitSeed ??
        (
          item.rawItemData as
            | { readonly dwInitSeed?: number; readonly seed?: number }
            | undefined
        )?.seed ??
        item.unitId
      const itemSeedRng = new D2Rng((Number(rawSeed) >>> 0) || 1)
      sockets = 1 + itemSeedRng.rand(Math.min(maxSockets, 2))
    } else {
      sockets = Math.min(maxSockets, 1)
    }
    item.socketed = true
    item.totalSockets = sockets
    if (item.rawItemData !== undefined) {
      const nextFlags = Number(item.rawItemData.flags ?? 0) | 0x800
      const nextRawFlags =
        Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0) | 0x800
      item.rawItemData = {
        ...item.rawItemData,
        socketed: true,
        totalSockets: sockets,
        flags: nextFlags,
        rawFlags: nextRawFlags,
      }
    }
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action,
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: resultContainer,
      item: this.serverEntryToItemData(item),
    })
  } else {
    const rawFlags = Number(item.rawItemData?.rawFlags ?? item.rawItemData?.flags ?? 0)
    if (
      item.rawItemData?.personalized === true ||
      (rawFlags & 0x01000000) !== 0 ||
      item.name.startsWith(`${player.name}'s `)
    ) {
      return false
    }
    // 1.13c D2Common.dll ITEMS_CanPersonalize (0x6FD74140..0x6FD74198) & D2Game.dll 0x6FCE076B (#1952):
    // - Requires ItemsTxt->bNameable != 0 (allows Nameable=1 stackable throwing weapons like Titan's Revenge,
    //   javelins, throwing axes/knives while rejecting arrows/bolts/potions/misc with Nameable=0).
    // - Rejects broken items (0x0100 or maxDurability > 0 && durability <= 0), ears (0x1000 / 'ear'),
    //   Low Quality (quality === 1), and quest items (quest != 0 / 'd33').
    const trimmedCode = item.code.trim().toLowerCase()
    if (
      trimmedCode === 'ear' ||
      trimmedCode === 'd33' ||
      item.quality === 1 ||
      item.rawItemData?.isEar === true ||
      item.rawItemData?.broken === true ||
      (rawFlags & 0x1100) !== 0
    ) {
      return false
    }
    const maxDur = Number(item.maxDurability ?? item.rawItemData?.maxDurability ?? 0)
    const curDur = Number(
      item.durability ?? item.rawItemData?.curDurability ?? item.rawItemData?.durability ?? maxDur,
    )
    if (maxDur > 0 && curDur <= 0) {
      return false
    }
    const baseInfo = getBaseSizeTable().get(item.code.trim())
    const tables = getEmbeddedDropTables()
    const base = tables.getBase(item.code) as
      | (Record<string, unknown> & {
          kind?: string
          quest?: number
        })
      | undefined
    const isNameable =
      baseInfo !== undefined
        ? baseInfo.nameable
        : base !== undefined && (base.kind === 'armor' || base.kind === 'weapon')
    if (!isNameable) {
      return false
    }
    if (
      baseInfo?.quest === true ||
      Number(base?.quest ?? 0) > 0 ||
      isQuestItemBase113c({ code: trimmedCode })
    ) {
      return false
    }
    item.name = `${player.name}'s ${item.name}`
    if (item.rawItemData !== undefined) {
      const nextFlags = Number(item.rawItemData.flags ?? 0) | 0x01000000
      const nextRawFlags =
        Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0) | 0x01000000
      item.rawItemData = {
        ...item.rawItemData,
        personalized: true,
        personalizedName: player.name,
        flags: nextFlags,
        rawFlags: nextRawFlags,
      }
    } else {
      item.rawItemData = {
        personalized: true,
        personalizedName: player.name,
        flags: 0x01000000,
        rawFlags: 0x01000000,
      } as never
    }
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action,
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: resultContainer,
      item: this.serverEntryToItemData(item),
    })
  }
  if (item.location === 'cursor') {
    const uiId = action === 'imbue' ? 0x06 : action === 'add_sockets' ? 0x0e : 0x0f
    this.emitToPlayer(player.unitId, {
      type: 'OpenUi',
      uiId,
      unitType: 1,
      unitId: npc.unitId,
      extra: 0,
    })
  }
  const questIndex = questWordIndex113c(questId)
  if (questIndex !== undefined) {
    player.questFlags[questIndex] =
      ((player.questFlags[questIndex] ?? 0) &
        ~(QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_113C)) |
      QUEST_FLAG_COMPLETED_113C |
      QUEST_FLAG_COMPLETED_NOW_113C
    this.emitQuestFlagSync113c(player, questId)
  }
  return true
}



function normalizeItemQualityCode113c(this: GameInstanceHost, rawQuality: unknown): number {
  if (typeof rawQuality === 'number' && Number.isFinite(rawQuality) && rawQuality >= 1 && rawQuality <= 9) {
    return Math.trunc(rawQuality)
  }
  if (typeof rawQuality === 'string') {
    switch (rawQuality.trim().toLowerCase()) {
      case 'low':
      case 'inferior':
      case 'crude':
      case 'damaged':
        return 1
      case 'normal':
        return 2
      case 'superior':
        return 3
      case 'magic':
        return 4
      case 'set':
        return 5
      case 'rare':
        return 6
      case 'unique':
        return 7
      case 'crafted':
        return 8
      case 'tempered':
        return 9
    }
  }
  return 2
}



function resolveServiceNpc(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
): InternalMonsterRecord | undefined {
  const npc = this.monsters.get(npcId)
  if (npc) {
    if (!npc.isNpc || npc.areaId !== player.areaId) return undefined
    if (player.activeNpcId !== undefined && player.activeNpcId !== npcId) return undefined
    if (!this.playerInNpcRange(player, npc)) return undefined
  } else if (player.activeNpcId !== undefined) {
    return undefined
  }
  return npc
}



/** Resolve an NPC and require the descriptor capability advertised by Npc.txt. */
function serviceNpcWithCapability(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  capability: 'canRepair' | 'canIdentify' | 'canHeal' | 'canHire' | 'canResurrectMerc',
): InternalMonsterRecord | undefined {
  const npc = this.resolveServiceNpc(player, npcId)
  if (npc === undefined) return undefined
  const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
  return descriptor?.[capability] === true ? npc : undefined
}



function spendGold(this: GameInstanceHost, player: InternalPlayerRecord, cost: number): boolean {
  if (cost <= 0) return true
  if (player.gold + player.goldBank < cost) return false
  let spentFromBank = false
  if (player.gold >= cost) {
    player.gold -= cost
  } else {
    const rem = cost - player.gold
    player.gold = 0
    player.goldBank = Math.max(0, player.goldBank - rem)
    spentFromBank = rem > 0
  }
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 14,
    value: player.gold,
  })
  if (spentFromBank) {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 15,
      value: player.goldBank,
    })
  }
  return true
}



/**
 * 1.13c `D2COMMON_10795_ITEMS_GetMaxStack` (`0x6fd760f0`) & `isRefillableThrowing` (`0x6fd74f00`):
 * resolves max stack for a repairable throwing weapon (`ItemTypes.txt` `Repair && Throwable` + `stackable`).
 */
function resolveRefillableThrowingMaxStack113c(this: GameInstanceHost, 
  item: ServerItemEntry,
  tables: TransactionCostTables,
): number {
  if (item.ethereal || item.rawItemData?.ethereal === true) return 0
  const code = item.code.trim()
  const itemRec = tables.items.get(code) ?? tables.items.get(code.toLowerCase())
  const itemTypeRec = itemRec ? tables.itemTypes.get(itemRec.type) : undefined
  const isRefillable = Boolean(
    itemRec && itemTypeRec && itemTypeRec.repair && itemTypeRec.throwable && itemRec.stackable,
  )
  const rawItem = item.rawItemData as Record<string, unknown> | undefined
  const rawBase = rawItem?.base as { maxStack?: number } | undefined
  const fallbackMax = Number(rawBase?.maxStack ?? rawItem?.maxStack ?? 0)
  if (!isRefillable) return 0
  const extraStack =
    (item.stats.get(254) ?? 0) ||
    (item.rawItemData?.stats.find((s) => s.statId === 254)?.value ?? 0)
  const canonicalMax = itemRec ? Math.min(511, itemRec.maxStack + extraStack) : 0
  return Math.max(canonicalMax, fallbackMax)
}



/** Whether `item` has depleted durability, refillable throwing stack, or `statId 204` charges (`0x6FCDE010`). */
function doesEntryNeedRepair113c(this: GameInstanceHost, item: ServerItemEntry, tables: TransactionCostTables): boolean {
  if (item.ethereal || item.rawItemData?.ethereal === true) return false
  const quality = this.normalizeItemQualityCode113c(item.rawItemData?.quality ?? item.quality)
  if (quality >= 4 && (!item.identified || item.rawItemData?.identified === false)) return false
  const isIndestructible =
    (item.stats.get(152) ?? 0) > 0 ||
    Boolean(item.rawItemData?.stats.some((s) => s.statId === 152 && s.value > 0)) ||
    Boolean(item.rawItemData?.runewordStats?.some((s) => s.statId === 152 && s.value > 0))
  if (!isIndestructible && item.maxDurability > 0 && item.durability < item.maxDurability) {
    return true
  }
  const maxStack = this.resolveRefillableThrowingMaxStack113c(item, tables)
  if (maxStack > 0 && item.quantity < maxStack) return true
  if (item.rawItemData?.stats.some((s) => s.statId === 204 && (s.value & 0xff) < ((s.value >> 8) & 0xff))) {
    return true
  }
  if (
    item.rawItemData?.runewordStats?.some(
      (s) => s.statId === 204 && (s.value & 0xff) < ((s.value >> 8) & 0xff),
    )
  ) {
    return true
  }
  const stat204 = item.stats.get(204)
  if (stat204 !== undefined && (stat204 & 0xff) < ((stat204 >> 8) & 0xff)) return true
  const charged = (item.rawItemData as Record<string, unknown> | undefined)?.chargedSkills
  if (Array.isArray(charged)) {
    for (const entry of charged as { charges?: number; maxCharges?: number }[]) {
      if (entry.maxCharges !== undefined && (entry.charges ?? 0) < entry.maxCharges) return true
    }
  }
  return false
}



/**
 * 1.13c `D2Game.dll` `NPC_RepairItem` (`0x6FCDE010`): restores durability, refillable throwing stack
 * (`STAT_QUANTITY = 70`), and charged skill charges (`STAT_ITEM_CHARGED_SKILL = 204`), skipping ethereal
 * and indestructible items, and keeps `item.rawItemData` in sync.
 */
function repairSingleItemEntry(this: GameInstanceHost, item: ServerItemEntry, tables: TransactionCostTables): boolean {
  if (item.ethereal || item.rawItemData?.ethereal === true) return false
  const quality = this.normalizeItemQualityCode113c(item.rawItemData?.quality ?? item.quality)
  if (quality >= 4 && (!item.identified || item.rawItemData?.identified === false)) return false
  const isIndestructible =
    (item.stats.get(152) ?? 0) > 0 ||
    Boolean(item.rawItemData?.stats.some((s) => s.statId === 152 && s.value > 0)) ||
    Boolean(item.rawItemData?.runewordStats?.some((s) => s.statId === 152 && s.value > 0))
  let changed = false
  if (!isIndestructible && item.maxDurability > 0 && item.durability < item.maxDurability) {
    item.durability = item.maxDurability
    if (item.stats.has(72)) item.stats.set(72, item.maxDurability)
    if (item.rawItemData !== undefined) {
      item.rawItemData = {
        ...item.rawItemData,
        durability: item.maxDurability,
        curDurability: item.maxDurability,
        broken: false,
        stats: item.rawItemData.stats.map((s) =>
          s.statId === 72 ? { ...s, value: item.maxDurability } : s,
        ),
      }
    }
    changed = true
  }
  const maxStack = this.resolveRefillableThrowingMaxStack113c(item, tables)
  if (maxStack > 0 && item.quantity < maxStack) {
    item.quantity = maxStack
    if (item.stats.has(70)) item.stats.set(70, maxStack)
    if (item.rawItemData !== undefined) {
      item.rawItemData = {
        ...item.rawItemData,
        quantity: maxStack,
        stats: item.rawItemData.stats.map((s) =>
          s.statId === 70 ? { ...s, value: maxStack } : s,
        ),
      }
    }
    changed = true
  }
  if (item.rawItemData !== undefined) {
    let statsChanged = false
    const nextStats = item.rawItemData.stats.map((s) => {
      if (s.statId !== 204) return s
      const curCharges = s.value & 0xff
      const maxCharges = (s.value >> 8) & 0xff
      if (maxCharges <= 0 || curCharges >= maxCharges) return s
      statsChanged = true
      const refilled = (s.value & ~0xff) | maxCharges
      item.stats.set(204, refilled)
      return { ...s, value: refilled }
    })
    let rwChanged = false
    const nextRwStats = (item.rawItemData.runewordStats ?? []).map((s) => {
      if (s.statId !== 204) return s
      const curCharges = s.value & 0xff
      const maxCharges = (s.value >> 8) & 0xff
      if (maxCharges <= 0 || curCharges >= maxCharges) return s
      rwChanged = true
      const refilled = (s.value & ~0xff) | maxCharges
      item.stats.set(204, refilled)
      return { ...s, value: refilled }
    })
    if (statsChanged || rwChanged) {
      item.rawItemData = {
        ...item.rawItemData,
        stats: statsChanged ? nextStats : item.rawItemData.stats,
        ...(rwChanged ? { runewordStats: nextRwStats } : {}),
      }
      changed = true
    }
  }
  const stat204 = item.stats.get(204)
  if (stat204 !== undefined) {
    const curCharges = stat204 & 0xff
    const maxCharges = (stat204 >> 8) & 0xff
    if (maxCharges > 0 && curCharges < maxCharges) {
      item.stats.set(204, (stat204 & ~0xff) | maxCharges)
      changed = true
    }
  }
  const rawItem = item.rawItemData as Record<string, unknown> | undefined
  const charged = rawItem?.chargedSkills
  if (Array.isArray(charged)) {
    for (const entry of charged as { charges?: number; maxCharges?: number }[]) {
      if (entry.maxCharges !== undefined && (entry.charges ?? 0) < entry.maxCharges) {
        entry.charges = entry.maxCharges
        changed = true
      }
    }
  }
  return changed
}



/** NpcRepairItem / NpcRepairAll (#10071 repair pricing). */
function handleNpcRepair(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  itemId?: number,
): void {
  const npc = this.serviceNpcWithCapability(player, npcId, 'canRepair')
  if (npc === undefined) return
  const targets =
    itemId !== undefined
      ? player.items.filter((item) => item.unitId === itemId)
      : player.items.filter((item) => item.location === 'equipped')
  // Repair-all uses D2Common #10071 (`computeRepairAllCost113c`), which also
  // covers refillable throwing stacks and charged items. Single-item repair
  // keeps the per-item #10107 type-3 path.
  const ctx = this.transactionCostContext(player, npc.hcIdx)
  let total = 0
  if (itemId === undefined) {
    const slots: (TransactionCostInput | null)[] = new Array(13).fill(null)
    for (const item of targets) {
      if (item.bodyLoc > 0 && item.bodyLoc < 13) {
        slots[item.bodyLoc] = this.transactionInputFromEntry(item)
      } else {
        slots.push(this.transactionInputFromEntry(item))
      }
    }
    total = computeRepairAllCost113c(slots, ctx)
  } else {
    for (const item of targets) {
      if (!this.doesEntryNeedRepair113c(item, ctx.tables)) continue
      total += this.serverItemPrice113c(player, npc.hcIdx, item, 3)
    }
  }
  if (total <= 0 || !this.spendGold(player, total)) return
  for (const item of targets) {
    if (!this.repairSingleItemEntry(item, ctx.tables)) continue
    const repairedData = this.serverEntryToItemData(item)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'repair',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: repairedData,
    })
    const ilvl = repairedData.ilvl ?? item.level ?? 99
    for (const s of [...(repairedData.stats ?? []), ...(repairedData.runewordStats ?? [])]) {
      if (s.statId !== STAT_ITEM_CHARGED_SKILL) continue
      const decoded = decodeStat204ChargedSkill113c(s, ilvl)
      if (!decoded) continue
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        unit: { unitType: 4, id: item.unitId },
        stat: STAT_ITEM_CHARGED_SKILL,
        param: ((decoded.skillId << 6) | (decoded.level & 0x3f)) >>> 0,
        value: decoded.maxCharges,
      })
    }
  }
}



function identifyItem(this: GameInstanceHost, player: InternalPlayerRecord, item: ServerItemEntry): void {
  if (item.identified) return
  item.identified = true
  if (item.rawItemData !== undefined) {
    const nextFlags = Number(item.rawItemData.flags ?? 0) | 0x10
    const nextRawFlags =
      Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0) | 0x10
    item.rawItemData = {
      ...item.rawItemData,
      identified: true,
      flags: nextFlags,
      rawFlags: nextRawFlags,
    }
  }
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'identify',
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: item.location === 'equipped' ? 'equipment' : 'inventory',
    item: this.serverEntryToItemData(item),
  })
}



/**
 * 1.13c Deckard Cain identify service (`D2Game.dll` `ACT1Q4_CanIdentifyFree` / `0x6FCE10E0`):
 * Cain identifies carried items for free once `a1q3` (The Search for Cain) is completed;
 * if Cain has NOT been rescued in A1Q3 (e.g. player rushed to Act 2+ where Cain stands in town),
 * Cain charges `100` gold per unidentified item (#1926).
 */
function handleNpcIdentifyAll(this: GameInstanceHost, player: InternalPlayerRecord, npcId: number): void {
  const npc = this.serviceNpcWithCapability(player, npcId, 'canIdentify')
  if (npc === undefined) return
  const unidItems = player.items.filter(
    (item) =>
      (item.location === 'inventory' || item.location === 'equipped') && !item.identified,
  )
  if (unidItems.length === 0) return
  const freeIdentify =
    npc.hcIdx === 146 ||
    hasQuestFlag113c(player.questFlags, 'a1q3', QUEST_FLAG_COMPLETED_113C)
  if (!freeIdentify) {
    const totalCost = unidItems.length * 100
    if (!this.spendGold(player, totalCost)) return
  }
  for (const item of unidItems) {
    this.identifyItem(player, item)
  }
}



function handleNpcIdentifyItem(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  itemId: number,
): void {
  const npc = this.resolveServiceNpc(player, npcId)
  if (npc === undefined) return
  const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
  if (descriptor?.canIdentify !== true && descriptor?.canGamble !== true) return
  const item = player.items.find((candidate) => candidate.unitId === itemId)
  if (!item || item.identified) return
  if (descriptor?.canIdentify === true && descriptor?.canGamble !== true) {
    const freeIdentify =
      npc.hcIdx === 146 ||
      hasQuestFlag113c(player.questFlags, 'a1q3', QUEST_FLAG_COMPLETED_113C)
    if (!freeIdentify && !this.spendGold(player, 100)) return
  }
  this.identifyItem(player, item)
}



/**
 * Mint an identified Rare (`quality = 6`) quest reward item (`QUESTS_CreateRareItem`,
 * `D2Game.dll` `0x6FC95DF0` / `0x6FC9D269` / `0x6FD060E0` / `0x6FC7F987`, #1929 / #1930).
 */
function grantQuestRareItem113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  code: string,
  ilvl: number,
  dropOrigin?: { readonly x: number; readonly y: number },
): ServerItemEntry | undefined {
  const tables = getEmbeddedDropTables()
  const cleanCode = code.trim().toLowerCase()
  const base = tables.getBase(cleanCode)
  if (base === undefined) return undefined
  const clampedIlvl = Math.max(1, Math.trunc(ilvl))
  const seed = this.rng.rand(0x7fffffff) || 1
  const itemRng = new D2Rng(seed)
  const rareAffixes = rollRareAffixes(
    base,
    clampedIlvl,
    tables.magicAffixes,
    tables.rareNames,
    tables.isA,
    itemRng,
    { itemClass: inferItemClassFromType(base.type ?? 'misc') },
  )
  const autoPrefixGroup = resolveAutoPrefixGroup(base, tables.itemTypes, tables.isA)
  const autoMagicAffix =
    autoPrefixGroup !== undefined
      ? rollAutoMagic(
          base,
          clampedIlvl,
          tables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE,
          tables.isA,
          itemRng,
          { group: autoPrefixGroup, isRare: true },
        )
      : null
  const staffMods =
    resolveStaffModsClass(base, tables.itemTypes) !== undefined
      ? rollStaffMods(base, clampedIlvl, tables.itemTypes, itemRng)
      : undefined
  const dropped = finalizeDroppedItem113c(
    createDroppedItem(base, 'rare', {
      rareAffixes,
      autoMagicAffix,
      staffMods,
      itemTypes: tables.itemTypes,
      ilvl: clampedIlvl,
      dwInitSeed: seed,
      itemRng,
      identified: true,
    }),
  )
  const free = this.findFreeGridSlot(
    player,
    'inventory',
    dropped.invWidth || base.invWidth || 1,
    dropped.invHeight || base.invHeight || 1,
    10,
    4,
  )
  const entry = this.createServerEntryFromItem(dropped, {
    location: free !== undefined ? 'inventory' : 'ground',
    x: free !== undefined ? free.x : 0,
    y: free !== undefined ? free.y : 0,
    areaId: player.areaId,
    ownerId: free !== undefined ? player.unitId : 0,
    storePage: free !== undefined ? 1 : 0,
    gamble: false,
  })
  entry.identified = true
  if (entry.rawItemData !== undefined) {
    const idFlags = ((entry.rawItemData.rawFlags ?? entry.rawItemData.flags ?? 0) | 0x10) >>> 0
    entry.rawItemData = {
      ...entry.rawItemData,
      identified: true,
      flags: idFlags,
      rawFlags: idFlags,
    }
  }
  if (free !== undefined) {
    player.items.push(entry)
    this.refreshPlayerAccruedMaxPools(player)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'add',
      itemId: entry.unitId,
      code: entry.code,
      x: entry.x,
      y: entry.y,
      container: 'inventory',
      item: this.serverEntryToItemData(entry),
    })
    return entry
  }
  const pos = this.findDropPosition(
    player.areaId,
    dropOrigin?.x ?? player.x,
    dropOrigin?.y ?? player.y,
    new Set(),
  )
  entry.x = pos.x
  entry.y = pos.y
  this.registerGroundItem113c(entry)
  this.broadcastToArea(player.areaId, {
    type: 'ItemEvent',
    action: 'drop',
    itemId: entry.unitId,
    code: entry.code,
    x: entry.x,
    y: entry.y,
    container: 'ground',
    item: { ...this.serverEntryToItemData(entry), action: 0x02 },
  })
  this.emitToPlayer(player.unitId, {
    type: 'PlaySound',
    unit: { unitType: 0, id: player.unitId },
    sound: 23,
  })
  return entry
}



/**
 * Grant a free quest mercenary (`D2Game.dll` A1Q2 Kashya `0x6FC9A9E0` Act 1 Rogue Scout /
 * A3Q2 Asheara `0x6FD06320` Act 3 Iron Wolf) ONLY if the player currently has no alive mercenary (#1930).
 */
function grantFreeQuestMercenary113c(this: GameInstanceHost, player: InternalPlayerRecord, act: 1 | 3): boolean {
  const hasAliveMerc = [...this.mercenaries.values()].some(
    (m) => m.ownerPlayerId === player.unitId && m.alive,
  )
  if (hasAliveMerc) return false
  const difficulty = (this.difficulty + 1) as 1 | 2 | 3
  const listSeed =
    ((this.currentMapSeed ^
      Math.imul(player.unitId, 0x9e3779b9) ^
      Math.imul(act, 0x85ebca6b) ^
      (this.rng.rand(0x7fffffff) >>> 0)) >>>
      0) || 1
  const candidates = generateHireCandidates113c(listSeed, player.level, act, difficulty, true)
  const chosen = candidates.length > 0 ? candidates[this.rng.rand(candidates.length)] : undefined
  if (chosen === undefined) return false
  this.hireMercenary(player.unitId, {
    act,
    subType: chosen.subTypeId,
    level: chosen.level,
    difficulty,
    name: chosen.name,
  })
  return true
}



/**
 * Synchronize Harrogath (`areaId === 109`) post-Anya-rescue town state (`D2Game.dll` `ACT5Q3`, #1929):
 * 1. Removes town Nihlathak NPC (`hcIdx === 514`) from `109` once any player has rescued Anya.
 * 2. Ensures Town Anya (`hcIdx === 512`) is present in `109`.
 * 3. Spawns Nihlathak's Temple permanent red portal (`classId === 60`, `destAreaId === 121`)
 *    next to Town Anya unless every rescued player has BOTH completed `a5q4` AND activated
 *    Halls of Pain waypoint (`123`).
 */
function findAreaInitFnAnchor113c(
  host: GameInstanceHost,
  areaId: number,
  classId: number,
): { readonly x: number; readonly y: number } | undefined {
  const fromLoaded = host.loadedAreas
    .get(areaId)
    ?.initFnAnchors?.find((a) => a.classId === classId)
  if (fromLoaded !== undefined) return fromLoaded
  return [...host.objects.values()].find((o) => o.areaId === areaId && o.classId === classId)
}

function upsertTownNpcAtAnchor113c(
  host: GameInstanceHost,
  spec: {
    readonly areaId: number
    readonly hcIdx: number
    readonly name: string
    readonly isVendor: boolean
    readonly anchorX: number
    readonly anchorY: number
  },
): InternalMonsterRecord | undefined {
  const loadedArea = host.loadedAreas.get(spec.areaId)
  const stand = loadedArea
    ? findStandableNear(
        (x, y) => host.isWorldWalkableForPlayer(spec.areaId, x, y),
        spec.anchorX,
        spec.anchorY,
        100,
      )
    : null
  if (loadedArea && stand === null) return undefined
  const destX = stand?.x ?? spec.anchorX
  const destY = stand?.y ?? spec.anchorY
  const existing = [...host.monsters.values()].find(
    (m) => m.areaId === spec.areaId && m.hcIdx === spec.hcIdx && !m.dead,
  )
  if (existing !== undefined) {
    if (Math.hypot(existing.x - destX, existing.y - destY) > 6) {
      const prevX = existing.x
      const prevY = existing.y
      existing.x = destX
      existing.y = destY
      existing.homeX = destX
      existing.homeY = destY
      existing.wanderTargetX = destX
      existing.wanderTargetY = destY
      existing.pathTargetX = destX
      existing.pathTargetY = destY
      existing.path = []
      existing.pathIndex = 0
      host.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        existing.unitId,
        spec.areaId,
        prevX,
        prevY,
        spec.areaId,
        destX,
        destY,
      )
      const assignEv = host.buildUnitAssignEvent('monster', existing.unitId)
      if (assignEv !== undefined) {
        for (const viewer of host.players.values()) {
          if (
            host.isPointInViewerAoi113c(viewer, spec.areaId, prevX, prevY) &&
            host.isPointInViewerAoi113c(viewer, spec.areaId, destX, destY)
          ) {
            host.emitToPlayer(viewer.unitId, assignEv)
          }
        }
      }
    }
    return existing
  }
  const spawnedId = host.spawnMonster({
    classId: spec.hcIdx,
    name: spec.name,
    x: destX,
    y: destY,
    areaId: spec.areaId,
    isNpc: true,
    isVendor: spec.isVendor,
    isKillable: false,
    aiDisabled: true,
  })
  return host.monsters.get(spawnedId)
}

function removeTownNpcFromArea113c(host: GameInstanceHost, areaId: number, hcIdx: number): void {
  const pending = host.pendingPresetMonsters.get(areaId)
  if (pending !== undefined) {
    for (const [roomIdx, roomPresets] of pending.byRoom.entries()) {
      const filtered = roomPresets.monsters.filter(
        (preset) => !(preset.superUniqueIndex === undefined && preset.classId === hcIdx),
      )
      if (
        filtered.length === 0 &&
        roomPresets.objectIds.length === 0 &&
        roomPresets.tileIds.length === 0
      ) {
        pending.byRoom.delete(roomIdx)
      } else if (filtered.length !== roomPresets.monsters.length) {
        pending.byRoom.set(roomIdx, {
          ...roomPresets,
          monsters: filtered,
        })
      }
    }
  }
  for (const [mId, mon] of [...host.monsters.entries()]) {
    if (mon.areaId === areaId && mon.hcIdx === hcIdx) {
      host.broadcastToArea(areaId, {
        type: 'UnitRemove',
        unitType: 1,
        id: mId,
        unitId: mId,
        areaId,
      })
      host.monsters.delete(mId)
      host.monsterCombat.delete(mId)
    }
  }
}

/**
 * 1.13c A1Q3 Rogue Encampment (`areaId === 1`) state sync (`D2Game.dll` `0x6FC9CD80` + `Objects.txt 385` `InitFn 54`):
 * When any player in the room has rescued Deckard Cain (`a1q3` `COMPLETED` / `REWARD_PENDING` / `PRIMARY_GOAL_DONE`),
 * spawns Town Deckard Cain (`hcIdx === 265`) at `Objects.txt 385` (`cain start position`) or beside the Rogue
 * Encampment stash (`Objects.txt 267`) so the player can receive free item identification in Act 1 town.
 */
function syncRogueEncampmentA1Q3State113c(
  this: GameInstanceHost,
  triggerPlayer?: InternalPlayerRecord,
): void {
  const candidates =
    triggerPlayer !== undefined
      ? [
          triggerPlayer,
          ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId),
        ]
      : [...this.players.values()]
  const rescuedPlayers = candidates.filter((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a1q3',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
    ),
  )
  if (rescuedPlayers.length === 0) return

  const cainStartAnchor = findAreaInitFnAnchor113c(this, 1, 385)
  const hasRogueEncampmentPresence =
    this.loadedAreas.has(1) ||
    cainStartAnchor !== undefined ||
    candidates.some((p) => p.areaId === 1) ||
    [...this.monsters.values()].some((m) => m.areaId === 1) ||
    [...this.objects.values()].some((o) => o.areaId === 1)
  if (!hasRogueEncampmentPresence) return

  const existingTownCain = [...this.monsters.values()].find(
    (m) => m.areaId === 1 && m.hcIdx === 265 && !m.dead,
  )
  if (existingTownCain !== undefined) return

  const stashAnchor = [...this.objects.values()].find(
    (o) => o.areaId === 1 && o.classId === 267,
  )
  const refPlayer = candidates.find((p) => p.areaId === 1)
  const area1 = this.loadedAreas.get(1)
  const baseX = cainStartAnchor
    ? cainStartAnchor.x
    : stashAnchor
      ? stashAnchor.x + 3
      : area1
        ? area1.spawnX + 4
        : refPlayer
          ? refPlayer.x + 4
          : LEGACY_TEST_GRID_SPAWN + 4
  const baseY = cainStartAnchor
    ? cainStartAnchor.y
    : stashAnchor
      ? stashAnchor.y + 2
      : area1
        ? area1.spawnY + 2
        : refPlayer
          ? refPlayer.y
          : LEGACY_TEST_GRID_SPAWN
  const stand = area1
    ? findStandableNear((x, y) => this.isWorldWalkableForPlayer(1, x, y), baseX, baseY, 100)
    : null
  if (area1 && stand === null) return
  this.spawnMonster({
    classId: 265,
    name: 'Deckard Cain',
    x: stand?.x ?? baseX,
    y: stand?.y ?? baseY,
    areaId: 1,
    isNpc: true,
    isKillable: false,
    aiDisabled: true,
  })
}

/**
 * 1.13c Act 2 Lut Gholein (`areaId === 40`) dynamic NPC init & relocation (`D2Game.dll` `InitFn 18` @ `0x6FCE7C20`
 * for `Objects.txt 121` & `InitFn 19` @ `0x6FCE9B70` for `Objects.txt 122`, #2000):
 * - Spawns/relocates **Jerhyn (`hcIdx === 201`)**: at `Object 121` (`(5147, 5191)`) before Act 2 quest progress,
 *   or at `Object 122` (`(5071, 5148)` Palace entrance) once any Act 2 quest (`a2q1..a2q6`) has started/progressed.
 * - Spawns **Kaelan (`hcIdx === 331`, `act2guard2`)** at `(obj122.x + 1, obj122.y)` while Duriel (`a2q6`) has not
 *   been defeated (`0x6FCE9B96..0x6FCE9BFB`), and removes Kaelan once Duriel is slain.
 */
function syncLutGholeinAct2NpcState113c(
  this: GameInstanceHost,
  triggerPlayer?: InternalPlayerRecord,
): void {
  const anchor121 = findAreaInitFnAnchor113c(this, 40, 121)
  const anchor122 = findAreaInitFnAnchor113c(this, 40, 122)
  if (!this.loadedAreas.has(40) && anchor121 === undefined && anchor122 === undefined) return

  const candidates =
    triggerPlayer !== undefined
      ? [
          triggerPlayer,
          ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId),
        ]
      : [...this.players.values()]
  const act2QuestStarted = candidates.some((p) => {
    for (const qId of ['a2q1', 'a2q2', 'a2q3', 'a2q4', 'a2q5', 'a2q6'] as const) {
      const idx = questWordIndex113c(qId)
      if (idx !== undefined && (p.questFlags[idx] ?? 0) !== 0) return true
    }
    return false
  })
  const jerhynAnchor = act2QuestStarted ? (anchor122 ?? anchor121) : (anchor121 ?? anchor122)
  if (jerhynAnchor !== undefined) {
    upsertTownNpcAtAnchor113c(this, {
      areaId: 40,
      hcIdx: 201,
      name: 'Jerhyn',
      isVendor: false,
      anchorX: jerhynAnchor.x,
      anchorY: jerhynAnchor.y,
    })
  }

  const durielSlain = candidates.some((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a2q6',
      QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
        QUEST_FLAG_CUSTOM_3_113C |
        QUEST_FLAG_CUSTOM_4_113C |
        QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_COMPLETED_NOW_113C,
    ),
  )
  if (durielSlain) {
    removeTownNpcFromArea113c(this, 40, 331)
  } else if (anchor122 !== undefined) {
    upsertTownNpcAtAnchor113c(this, {
      areaId: 40,
      hcIdx: 331,
      name: 'Kaelan',
      isVendor: false,
      anchorX: anchor122.x + 1,
      anchorY: anchor122.y,
    })
  }
}

/**
 * 1.13c Act 3 Kurast Docks (`areaId === 75`) dynamic NPC init & relocation (`D2Game.dll` `InitFn 49` @ `0x6FD086A0`
 * for `Objects.txt 378`, `InitFn 50` @ `0x6FD08560` for `Objects.txt 379`, & `InitFn 52` @ `0x6FD08310` for
 * `Objects.txt 382`, #2000):
 * - Spawns/relocates **Hratli (`hcIdx === 253`, `VendorNpcId.HRATLI`)** at `Object 378` (docks) before Act 3
 *   intro/quest progress or at `Object 379` (forge) once Act 3 has progressed.
 * - Spawns **Natalya (`hcIdx === 297`)** at `Object 382` while Mephisto (`a3q6`) is uncompleted, and removes
 *   Natalya once `a3q6` is completed (`0x6FD08344..0x6FD08499`).
 */
function syncKurastDocksAct3NpcState113c(
  this: GameInstanceHost,
  triggerPlayer?: InternalPlayerRecord,
): void {
  const anchor378 = findAreaInitFnAnchor113c(this, 75, 378)
  const anchor379 = findAreaInitFnAnchor113c(this, 75, 379)
  const anchor382 = findAreaInitFnAnchor113c(this, 75, 382)
  if (
    !this.loadedAreas.has(75) &&
    anchor378 === undefined &&
    anchor379 === undefined &&
    anchor382 === undefined
  ) {
    return
  }

  const candidates =
    triggerPlayer !== undefined
      ? [
          triggerPlayer,
          ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId),
        ]
      : [...this.players.values()]
  const act3Progressed = candidates.some((p) => {
    if ((p.questFlags[16] ?? 0) !== 0) return true
    for (const qId of ['a3q1', 'a3q2', 'a3q3', 'a3q4', 'a3q5', 'a3q6'] as const) {
      const idx = questWordIndex113c(qId)
      if (idx !== undefined && (p.questFlags[idx] ?? 0) !== 0) return true
    }
    return false
  })
  const hratliAnchor = act3Progressed ? (anchor379 ?? anchor378) : (anchor378 ?? anchor379)
  if (hratliAnchor !== undefined) {
    upsertTownNpcAtAnchor113c(this, {
      areaId: 75,
      hcIdx: 253,
      name: 'Hratli',
      isVendor: true,
      anchorX: hratliAnchor.x,
      anchorY: hratliAnchor.y,
    })
  }

  const mephistoCompleted = candidates.some((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a3q6',
      QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
        QUEST_FLAG_REWARD_PENDING_113C |
        QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_COMPLETED_NOW_113C,
    ),
  )
  if (mephistoCompleted) {
    removeTownNpcFromArea113c(this, 75, 297)
  } else if (anchor382 !== undefined) {
    upsertTownNpcAtAnchor113c(this, {
      areaId: 75,
      hcIdx: 297,
      name: 'Natalya',
      isVendor: false,
      anchorX: anchor382.x,
      anchorY: anchor382.y,
    })
  }
}

/**
 * 1.13c A1Q4 Tower Cellar Level 5 (`areaId === 25`) quest chest init (`D2Game.dll` `OBJECTS_Init39_CountessChest`
 * @ `0x6FC88AB0` + `0x6FC88D20`, #1988):
 * When `a1q4` (`The Forgotten Tower`) already has `QFLAG_REWARDGRANTED` (`0x0001`), `Objects.txt 371`
 * initializes in `OBJMODE_OPENED (2)` so a completed game does not present an unopenable sealed chest.
 */
function syncTowerCellarA1Q4State113c(
  this: GameInstanceHost,
  areaId = 25,
  triggerPlayer?: InternalPlayerRecord,
): void {
  const candidates =
    triggerPlayer !== undefined
      ? [triggerPlayer, ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId)]
      : [...this.players.values()]
  const countessCompleted = candidates.some((p) =>
    hasQuestFlag113c(p.questFlags, 'a1q4', QUEST_FLAG_COMPLETED_113C),
  )
  if (!countessCompleted) return
  for (const obj of this.objects.values()) {
    if (obj.areaId === areaId && obj.classId === 371 && obj.mode === 0) {
      this.setObjectMode(obj, 2)
    }
  }
}

function syncHarrogathA5Q3State113c(this: GameInstanceHost, triggerPlayer?: InternalPlayerRecord): void {
  const candidates =
    triggerPlayer !== undefined
      ? [triggerPlayer, ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId)]
      : [...this.players.values()]
  const anchor459 = findAreaInitFnAnchor113c(this, 109, 459)
  const anchor461 = findAreaInitFnAnchor113c(this, 109, 461)
  const anchor543 = findAreaInitFnAnchor113c(this, 109, 543) ?? findAreaInitFnAnchor113c(this, 109, 542)

  // D2Game.dll InitFn 70/71 (0x6FC7C470 / 0x6FC7C3A0): always ensure Larzuk (`hcIdx === 511`) at Object 543/542 (#2000).
  if (anchor543 !== undefined) {
    upsertTownNpcAtAnchor113c(this, {
      areaId: 109,
      hcIdx: 511,
      name: 'Larzuk',
      isVendor: true,
      anchorX: anchor543.x,
      anchorY: anchor543.y,
    })
  }

  const rescuedPlayers = candidates.filter((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a5q3',
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_113C,
    ),
  )
  const enteredNihlathakTemple = candidates.some(
    (p) => (p.areaId >= 121 && p.areaId <= 124) || p.waypoints.has(123),
  )

  if (rescuedPlayers.length === 0) {
    // D2Game.dll InitFn 68 (0x6FC7C5C0 -> 0x6FC7F560): Town Nihlathak (`hcIdx === 514`) stands at Object 461
    // only while Anya (`a5q3`) is unrescued AND no player has entered Nihlathak's Temple (`121..124`, #2000).
    if (enteredNihlathakTemple) {
      removeTownNpcFromArea113c(this, 109, 514)
    } else if (anchor461 !== undefined) {
      upsertTownNpcAtAnchor113c(this, {
        areaId: 109,
        hcIdx: 514,
        name: 'Nihlathak',
        isVendor: true,
        anchorX: anchor461.x,
        anchorY: anchor461.y,
      })
    }
    return
  }

  const hasHarrogathPresence =
    this.loadedAreas.has(109) ||
    anchor459 !== undefined ||
    candidates.some((p) => p.areaId === 109) ||
    [...this.monsters.values()].some((m) => m.areaId === 109) ||
    [...this.objects.values()].some((o) => o.areaId === 109)
  if (!hasHarrogathPresence) return

  // 1. Remove town Nihlathak (`hcIdx === 514`) from Harrogath (109), including unactivated room presets (#1990).
  removeTownNpcFromArea113c(this, 109, 514)

  // 2. Ensure Town Anya (`hcIdx === 512`) exists in Harrogath (109), anchored first on Object 459 (InitFn 66 @ 0x6FC7EB30).
  let townAnya = [...this.monsters.values()].find(
    (m) => m.areaId === 109 && m.hcIdx === 512 && !m.dead,
  )
  if (townAnya === undefined) {
    const refPlayer = candidates.find((p) => p.areaId === 109)
    const area109 = this.loadedAreas.get(109)
    const baseX = anchor459
      ? anchor459.x
      : area109
        ? area109.spawnX + 6
        : refPlayer
          ? refPlayer.x + 4
          : LEGACY_TEST_GRID_SPAWN + 4
    const baseY = anchor459
      ? anchor459.y
      : area109
        ? area109.spawnY + 6
        : refPlayer
          ? refPlayer.y
          : LEGACY_TEST_GRID_SPAWN
    const stand = area109
      ? findStandableNear((x, y) => this.isWorldWalkableForPlayer(109, x, y), baseX, baseY, 100)
      : null
    if (!area109 || stand !== null) {
      const anyaId = this.spawnMonster({
        classId: 512,
        name: 'Anya',
        x: stand?.x ?? baseX,
        y: stand?.y ?? baseY,
        areaId: 109,
        isNpc: true,
        isVendor: true,
        isKillable: false,
        aiDisabled: true,
      })
      townAnya = this.monsters.get(anyaId)
    }
  }

  // 3. Open (or close) Nihlathak's Temple red portal (`109 -> 121` Pindleskin).
  // D2Game.dll 0x6fc77f85..0x6fc77fad: checks BOTH bit 0 (`0x0001`) and bit 1 (`0x0002`) of quest `0x26` (`a5q4`) + WP `123` (#1987).
  const shouldKeepPortalOpen = rescuedPlayers.some(
    (p) =>
      !(
        hasQuestFlag113c(
          p.questFlags,
          'a5q4',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
        ) && p.waypoints.has(123)
      ),
  )
  const existingPortal = [...this.objects.values()].find(
    (o) => o.areaId === 109 && o.classId === 60 && o.destAreaId === 121,
  )
  if (shouldKeepPortalOpen) {
    if (existingPortal === undefined && townAnya !== undefined) {
      const targetX = townAnya.x + 3
      const targetY = townAnya.y + 2
      const hasLoadedArea109 = this.loadedAreas.has(109)
      const stand = hasLoadedArea109
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(109, x, y),
            targetX,
            targetY,
            100,
          )
        : null
      if (!hasLoadedArea109 || stand !== null) {
        const portalId = this.spawnObject({
          classId: 60,
          x: stand?.x ?? targetX,
          y: stand?.y ?? targetY,
          areaId: 109,
          mode: 2,
          destAreaId: 121,
        })
        const returnObj = [...this.objects.values()].find(
          (o) => o.areaId === 121 && o.classId === 60 && o.destAreaId === 109,
        )
        const townPortalObj = this.objects.get(portalId)
        if (returnObj !== undefined && townPortalObj !== undefined) {
          returnObj.linkedPortalId = townPortalObj.unitId
          townPortalObj.linkedPortalId = returnObj.unitId
        }
      }
    } else if (existingPortal !== undefined && existingPortal.mode !== 2) {
      this.setObjectMode(existingPortal, 2)
    }
  } else if (existingPortal !== undefined) {
    this.broadcastToArea(109, {
      type: 'UnitRemove',
      unitType: 2,
      id: existingPortal.unitId,
      unitId: existingPortal.unitId,
      areaId: 109,
    })
    this.objects.delete(existingPortal.unitId)
  }
}

/**
 * 1.13c A5Q3 Frozen River (`areaId === 114`) `InitFn 67` (`D2Game.dll` `0x6FC7E8D0 -> 0x6FC7E940`, #2020):
 * Real DRLG stamps server-only marker `Objects.txt 460` (`drehya_start_outside_town`, `Sync = 0`) in Frozen River (`Area 114`)
 * and relies on `InitFn 67` to spawn interactive `Objects.txt 558` (`anya_framing` / Frozen Anya, `OperateFn = 67`)
 * at `(anchor460.x, anchor460.y)` only while `a5q3` is unrescued (`!(REWARD_PENDING | COMPLETED)`).
 */
function syncFrozenRiverA5Q3State113c(
  this: GameInstanceHost,
  triggerPlayer?: InternalPlayerRecord,
): void {
  const anchor460 = findAreaInitFnAnchor113c(this, 114, 460)
  if (anchor460 === undefined) return
  const candidates =
    triggerPlayer !== undefined
      ? [triggerPlayer, ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId)]
      : [...this.players.values()]
  const rescued = candidates.some((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a5q3',
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_113C,
    ),
  )
  if (rescued) {
    for (const [oid, obj] of [...this.objects.entries()]) {
      if (obj.areaId === 114 && obj.classId === 558) {
        this.objects.delete(oid)
        this.doorFootprintsWatermark = -1
        this.broadcastToArea(114, {
          type: 'UnitRemove',
          unitType: 2,
          id: oid,
          unitId: oid,
          areaId: 114,
        })
      }
    }
    return
  }
  const existing558 = [...this.objects.values()].find(
    (obj) => obj.areaId === 114 && obj.classId === 558,
  )
  if (existing558 === undefined) {
    this.spawnObject({
      classId: 558,
      x: anchor460.x,
      y: anchor460.y,
      areaId: 114,
      mode: 0,
    })
  }
}

/**
 * 1.13c A2Q6 Duriel's Lair (`areaId === 73`) post-kill state sync (`D2Game.dll` `0x6FCE8800` + `InitFn 38`, #1982):
 * Opens `tyrael's door` (`Objects.txt 153`) to `OBJMODE_OPENED (2)` and ensures `Tyrael` (`hcIdx === 251`, `tyrael1`)
 * is spawned inside the back chamber once Duriel (`hcIdx === 211`) is defeated.
 */
function syncDurielsLairA2Q6State113c(
  this: GameInstanceHost,
  areaId = 73,
  fallbackX?: number,
  fallbackY?: number,
  triggerPlayer?: InternalPlayerRecord,
): void {
  const candidates =
    triggerPlayer !== undefined
      ? [
          triggerPlayer,
          ...[...this.players.values()].filter((p) => p.unitId !== triggerPlayer.unitId),
        ]
      : [...this.players.values()]
  const durielSlain =
    fallbackX !== undefined ||
    candidates.some((p) =>
      hasQuestFlag113c(
        p.questFlags,
        'a2q6',
        QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_CUSTOM_3_113C |
          QUEST_FLAG_CUSTOM_4_113C |
          QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
          QUEST_FLAG_COMPLETED_NOW_113C,
      ),
    )
  if (!durielSlain) return

  const hasPresence =
    this.loadedAreas.has(areaId) ||
    candidates.some((p) => p.areaId === areaId) ||
    [...this.monsters.values()].some((m) => m.areaId === areaId) ||
    [...this.objects.values()].some((o) => o.areaId === areaId)
  if (!hasPresence) return

  let tyraelDoor: InternalObjectRecord | undefined
  for (const o of this.objects.values()) {
    if (o.areaId === areaId && o.classId === 153) {
      if (tyraelDoor === undefined) tyraelDoor = o
      if (o.mode !== 2) {
        this.setObjectMode(o, 2)
      }
    }
  }

  const existingTyrael = [...this.monsters.values()].find(
    (m) => m.areaId === areaId && m.hcIdx === 251 && !m.dead,
  )
  if (existingTyrael !== undefined) return

  const loadedArea = this.loadedAreas.get(areaId)
  const refPlayer = candidates.find((p) => p.areaId === areaId)
  const rawX = tyraelDoor
    ? tyraelDoor.x - 13
    : fallbackX !== undefined
      ? fallbackX - 8
      : loadedArea
        ? loadedArea.spawnX - 8
        : refPlayer
          ? refPlayer.x - 4
          : LEGACY_TEST_GRID_SPAWN
  const rawY = tyraelDoor
    ? tyraelDoor.y + 3
    : fallbackY !== undefined
      ? fallbackY
      : loadedArea
        ? loadedArea.spawnY
        : refPlayer
          ? refPlayer.y
          : LEGACY_TEST_GRID_SPAWN
  const stand = loadedArea
    ? findStandableNear((x, y) => this.isWorldWalkableForPlayer(areaId, x, y), rawX, rawY, 100)
    : null
  if (loadedArea && stand === null) return
  this.spawnMonster({
    classId: 251,
    defId: 'tyrael1',
    name: 'Tyrael',
    x: stand?.x ?? rawX,
    y: stand?.y ?? rawY,
    areaId,
    isNpc: true,
    isKillable: false,
    aiDisabled: true,
    experience: 0,
  })
}



/** 0x4F + 0x4E: send the 1.13c hire candidate list for a mercenary vendor's act (`D2Game.dll` `0x6FCDCED0` / `0x6FCDD330`). */
function handleNpcHireList(this: GameInstanceHost, player: InternalPlayerRecord, npcId: number): void {
  const npc = this.serviceNpcWithCapability(player, npcId, 'canHire')
  if (npc === undefined) return
  const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
  const act = ((descriptor?.actIndex ?? 0) + 1) as 1 | 2 | 3 | 5
  const difficulty = (this.difficulty === 2 ? 3 : this.difficulty === 1 ? 2 : 1) as 1 | 2 | 3
  const listSeed =
    ((this.currentMapSeed ^ Math.imul(player.unitId, 0x9e3779b9) ^ Math.imul(act, 0x85ebca6b)) >>>
      0) ||
    1
  const candidates = generateHireCandidates113c(listSeed, player.level, act, difficulty, true)
  player.mercHireCandidates = candidates
  this.emitToPlayer(player.unitId, { type: 'Merc', kind: 'hireList' })
  for (const cand of candidates) {
    this.emitToPlayer(player.unitId, {
      type: 'Merc',
      kind: 'hireList',
      nameId: cand.nameId,
      value: cand.seed,
    })
  }
}



/**
 * HireMerc/MercHire (`0x36`, `D2Game.dll` `0x6FCE1510` + `D2Common.dll` `#10458` @ `0x6FD7CCC0`):
 * - Candidate level `L = max(2, clvl - 5 + rand(5))`
 * - Hire cost `max(Gold, trunc(Gold * (100 + 15 * (L - baseRow.level)) / 100))`
 * - Strictly filters `Hireling.txt` by `version === 100`.
 */
function handleNpcHire(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  mercId: number,
): void {
  const npc = this.resolveServiceNpc(player, npcId)
  const descriptor = npc ? getTownNpcDescriptorByHcIdx(npc.hcIdx) : undefined
  if (npc === undefined || !descriptor?.canHire) return
  const act = ((descriptor?.actIndex ?? 0) + 1) as 1 | 2 | 3 | 5
  const difficulty = (this.difficulty + 1) as 1 | 2 | 3
  const listSeed =
    ((this.currentMapSeed ^ Math.imul(player.unitId, 0x9e3779b9) ^ Math.imul(act, 0x85ebca6b)) >>>
      0) ||
    1
  const candidates =
    player.mercHireCandidates &&
    player.mercHireCandidates.length > 0 &&
    player.mercHireCandidates[0]?.actIndex === act - 1
      ? player.mercHireCandidates
      : generateHireCandidates113c(listSeed, player.level, act, difficulty, true)
  player.mercHireCandidates = candidates

  const matchedCandidate =
    candidates.find((c) => c.nameId === mercId || c.mercId === mercId) ??
    candidates.find((c) => c.subTypeId === mercId || c.record?.id === mercId) ??
    (mercId >= 0 && mercId < candidates.length ? candidates[mercId] : undefined)

  let chosenSubTypeId: number
  let hireLevel: number
  let cost: number
  let chosenName: string | undefined

  if (matchedCandidate !== undefined) {
    chosenSubTypeId = matchedCandidate.subTypeId
    hireLevel = matchedCandidate.level
    cost = matchedCandidate.cost
    chosenName = matchedCandidate.name
  } else {
    const actDiffRows = HIRELING_RECORDS.filter(
      (entry) =>
        entry.version === 100 &&
        entry.act === act &&
        entry.difficulty === difficulty &&
        (entry.id === mercId || entry.subTypeId === mercId),
    )
    if (actDiffRows.length === 0) return
    let baseRow = actDiffRows[0]!
    for (const row of actDiffRows) {
      if (row.level < baseRow.level) baseRow = row
    }
    const effPlayerLevel = Math.max(1, player.level)
    hireLevel =
      candidates[0]?.level ?? Math.max(2, effPlayerLevel + ((listSeed >>> 0) % 5) - 5)
    cost = computeMercHireCost113c(baseRow.hireCost, hireLevel, baseRow.level)
    chosenSubTypeId = baseRow.subTypeId
  }

  if (!this.spendGold(player, cost)) return
  if (matchedCandidate !== undefined) {
    player.mercHireCandidates = candidates.filter((c) => c.nameId !== matchedCandidate.nameId)
  }
  this.hireMercenary(player.unitId, {
    act,
    subType: chosenSubTypeId,
    level: hireLevel,
    difficulty,
    ...(chosenName !== undefined ? { name: chosenName } : {}),
  })
}



/** Resurrect the player's dead mercenary at the NPC (`D2Game.dll` `0x6FCE0EA1` + `D2Common.dll` `#11097` @ `0x6FD7CC60`). */
function handleMercResurrect(this: GameInstanceHost, player: InternalPlayerRecord, npcId: number): void {
  const npc = this.resolveServiceNpc(player, npcId)
  if (npc === undefined) return
  const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
  // 1.13c: mercenary captains (canHire) and Tyrael (canResurrectMerc) revive mercs.
  if (descriptor?.canHire !== true && descriptor?.canResurrectMerc !== true) return
  const merc = [...this.mercenaries.values()].find(
    (entry) => entry.ownerPlayerId === player.unitId,
  )
  if (!merc || merc.alive) return
  const cost = computeMercResurrectCost113c(merc.level)
  this.emitToPlayer(player.unitId, {
    type: 'Merc',
    kind: 'stat',
    nameId: merc.subType,
    value: cost,
  })
  if (!this.spendGold(player, cost)) return
  merc.alive = true
  merc.mode = 1
  merc.state = 'follow'
  merc.hp = merc.maxHp
  merc.hp256 = merc.maxHp256 ?? merc.maxHp * 256
  merc.areaId = player.areaId
  merc.x = player.x + 1
  merc.y = player.y + 1
  if (merc.oracleMercAi113c !== undefined) {
    merc.oracleMercAi113c.activeVelBonus = 0
    merc.oracleMercAi113c.ovPathType = 0
    merc.oracleMercAi113c.ovVelocity = 0
    merc.oracleMercAi113c.ovNewDist = 0
    merc.oracleMercAi113c.actionFrame = 0
    merc.oracleMercAi113c.animEndFrame = 0
    merc.oracleMercAi113c.pendingAction = undefined
    merc.oracleMercAi113c.nextAiFrame = this.currentFrame + 15
  }
  this.areaPathWorld.removeMonster(merc.unitId)
  this.areaPathWorld.spawnMonster(
    merc.areaId,
    {
      unitId: merc.unitId,
      hcIdx: merc.classId,
      areaId: merc.areaId,
      x: Math.floor(merc.x + 0.5),
      y: Math.floor(merc.y + 0.5),
      mode: 1,
      dead: false,
    },
    this.currentFrame,
  )
  this.broadcastToArea(merc.areaId, {
    type: 'UnitAssign',
    unitType: 'monster',
    unitId: merc.unitId,
    classId: merc.classId,
    name: merc.name,
    x: merc.x,
    y: merc.y,
    areaId: merc.areaId,
    unit: {
      unitType: 1,
      id: merc.unitId,
      classId: merc.classId,
      name: merc.name,
      x: merc.x,
      y: merc.y,
      mode: 1,
      lifePct: 128,
    },
  })
  this.broadcastToArea(merc.areaId, {
    type: 'Merc',
    kind: 'assign',
    mercId: merc.unitId,
    ownerId: player.unitId,
    classId: merc.classId,
  })
  // D2Game.dll 0x6fce0faa: clear the 0x9B dead-hireling record (`nameId = 0xFFFF, cost = 0`)
  // after resurrection so subsequent life% updates do not keep `client.merc.isDead = true`.
  this.emitToPlayer(player.unitId, {
    type: 'Merc',
    kind: 'stat',
    nameId: 0xffff,
    value: 0,
  })
  this.broadcastToArea(merc.areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId: merc.unitId,
    statId: 12,
    value: Math.max(1, Math.floor(merc.level)),
  })
  this.broadcastToArea(merc.areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId: merc.unitId,
    statId: 13,
    value: Math.max(0, Math.floor(merc.experience)),
  })
  this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
  this.syncMercenaryOwnerAura(player, merc.activeAura, merc, true)
}



function handleNpcInteract(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  healRequested = false,
  fromInteractPacket = false,
): void {
  const npc = this.monsters.get(npcId)
  // Static quest NPCs may not have a runtime record in synthetic tests; when one
  // exists, enforce the 1.13c #10407 arrival reach.
  if (
    npc &&
    (!npc.isNpc ||
      npc.areaId !== player.areaId ||
      !this.playerInNpcRange(player, npc) ||
      !this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y))
  ) {
    if (npc && npc.isNpc && npc.areaId === player.areaId && player.pendingInteraction === undefined) {
      player.pendingInteraction = { kind: 'npc', id: npcId }
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
    }
    return
  }
  player.pendingInteraction = undefined
  player.pendingInteractionSteps = 0
  player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
  player.activeNpcId = npcId
  if (npc !== undefined) {
    const introBit = NPC_INTRO_BIT_BY_HCIDX_113C.get(npc.hcIdx)
    if (introBit !== undefined && player.npcIntro.byteLength === 52) {
      const byteIdx = 4 + this.difficulty * 8 + (introBit >> 3)
      if (byteIdx >= 4 && byteIdx < 28) {
        player.npcIntro[byteIdx] = (player.npcIntro[byteIdx] ?? 0) | (1 << (introBit & 7))
      }
    }
  }
  // A1Q6: Act 1 Warriv (`hcIdx === 155`, `D2Game.dll` `a1q6.cpp` `0x6FC82640` / `0x6FC88150`, #1960):
  // talking to Warriv after Andariel's death transitions `a1q6` to `QUEST_FLAG_COMPLETED_113C` (`0x0001`).
  // If Andariel was killed in this same game (`QUEST_FLAG_COMPLETED_NOW_113C` `0x2000`), Warriv also sets
  // `QUEST_FLAG_CUSTOM_4_113C` (`0x0010`), permanently arming the 1.13c Andariel Quest Drop (`Andarielq`) in future games.
  if (npc?.hcIdx === 155) {
    if (hasQuestFlag113c(player.questFlags, 'a1q6', QUEST_FLAG_COMPLETED_NOW_113C)) {
      this.setPlayerQuestFlag(
        player,
        'a1q6',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_4_113C,
      )
    } else if (
      hasQuestFlag113c(
        player.questFlags,
        'a1q6',
        QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !hasQuestFlag113c(player.questFlags, 'a1q6', QUEST_FLAG_COMPLETED_113C)
    ) {
      this.setPlayerQuestFlag(player, 'a1q6', QUEST_FLAG_COMPLETED_113C)
    }
  }
  // A2Q4: Drognan (`hcIdx === 177`) & Jerhyn (`hcIdx === 201`) unlock the Palace Harem (`40 -> 50`)
  // guard Kaelan gate once Tainted Sun (`a2q3`) is completed (#1961).
  if (npc?.hcIdx === 177 || npc?.hcIdx === 201) {
    if (
      hasQuestFlag113c(player.questFlags, 'a2q3', QUEST_FLAG_COMPLETED_113C) &&
      !hasQuestFlag113c(
        player.questFlags,
        'a2q4',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_STARTED_113C,
      )
    ) {
      this.setPlayerQuestFlag(player, 'a2q4', QUEST_FLAG_STARTED_113C)
    }
  }
  // A2Q6 (#1982):
  // 1. Tyrael in Duriel's Lair (`hcIdx === 251`, `tyrael1`): opens permanent ownerless blue Town Portal
  //    (`Objects.txt 59`, `Area 73 <-> Area 40`) and sets `0x0008` (`QUEST_FLAG_CUSTOM_3_113C`, "Talk to Jerhyn").
  if (npc?.hcIdx === 251) {
    const durielAliveInArea = [...this.monsters.values()].some(
      (m) => m.areaId === player.areaId && m.hcIdx === 211 && !m.dead,
    )
    const hasPostDurielProgress = hasQuestFlag113c(
      player.questFlags,
      'a2q6',
      QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
        QUEST_FLAG_CUSTOM_3_113C |
        QUEST_FLAG_CUSTOM_4_113C |
        QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_COMPLETED_NOW_113C,
    )
    if (!durielAliveInArea || hasPostDurielProgress) {
      let lairPortal = [...this.objects.values()].find(
        (o) =>
          o.areaId === player.areaId &&
          o.classId === 59 &&
          o.portalOwnerId === undefined &&
          o.destAreaId === 40,
      )
      if (lairPortal === undefined) {
        const rawX = Math.round(npc.x) + 3
        const rawY = Math.round(npc.y) + 3
        const lairPos = this.loadedAreas.has(player.areaId)
          ? findFreePortalCoordNear113c({
              originX: rawX,
              originY: rawY,
              existingPortals: [...this.objects.values()].filter(
                (o) => o.areaId === player.areaId && (o.classId === 59 || o.classId === 60),
              ),
              isWalkable: (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
            })
          : { x: rawX, y: rawY }
        const townPos = this.resolveTownPortalMouth(40) ?? { x: 5140, y: 5055 }
        const lairPortalId = this.spawnObject({
          classId: 59,
          x: lairPos.x,
          y: lairPos.y,
          areaId: player.areaId,
          mode: 2,
          destAreaId: 40,
        })
        const townPortalId = this.spawnObject({
          classId: 59,
          x: townPos.x,
          y: townPos.y,
          areaId: 40,
          mode: 2,
          destAreaId: player.areaId,
        })
        lairPortal = this.objects.get(lairPortalId)
        const townPortal = this.objects.get(townPortalId)
        if (lairPortal && townPortal) {
          lairPortal.linkedPortalId = townPortal.unitId
          townPortal.linkedPortalId = lairPortal.unitId
        }
        this.broadcastToArea(player.areaId, {
          type: 'Portal',
          portalId: lairPortalId,
          ownerId: 0,
          ownerName: 'Tyrael',
          areaId: player.areaId,
          destAreaId: 40,
          localId: lairPortalId,
          remoteId: townPortalId,
          flags: 1,
        })
        this.broadcastToArea(40, {
          type: 'Portal',
          portalId: townPortalId,
          ownerId: 0,
          ownerName: 'Tyrael',
          areaId: 40,
          destAreaId: player.areaId,
          localId: townPortalId,
          remoteId: lairPortalId,
          flags: 1,
        })
      } else if (lairPortal.mode !== 2) {
        this.setObjectMode(lairPortal, 2)
      }
      for (const recipient of this.getQuestEligiblePartyRecipients113c(player, player.areaId, {
        includeSameActTown: true,
      })) {
        if (
          hasQuestFlag113c(
            recipient.questFlags,
            'a2q6',
            QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_4_113C,
          )
        ) {
          continue
        }
        this.setPlayerQuestFlag(
          recipient,
          'a2q6',
          QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_CUSTOM_3_113C,
        )
      }
    }
  }
  // 2. Jerhyn (`hcIdx === 201`): advances post-Duriel/Tyrael `a2q6` from `0x0008` -> `0x0010` ("Talk to Meshif").
  if (npc?.hcIdx === 201) {
    if (
      !hasQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_COMPLETED_113C) &&
      hasQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_CUSTOM_3_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
      )
    ) {
      const clearedCustom3 = clearQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_CUSTOM_3_113C,
      )
      const updated = this.setPlayerQuestFlag(
        player,
        'a2q6',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_CUSTOM_4_113C,
      )
      if (clearedCustom3 && !updated) {
        this.emitQuestFlagSync113c(player, 'a2q6')
      }
    }
  }
  // 3. Act 2 Meshif (`hcIdx === 210`): completes `a2q6` (`0x2001`), removes leftover Act 2 staff/amulet
  //    quest items (`'hst'`, `'vip'`, `'msf'`), and unlocks Sail East (`S2C 0x61 02`).
  if (npc?.hcIdx === 210) {
    if (
      !hasQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_COMPLETED_113C) &&
      hasQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_CUSTOM_4_113C)
    ) {
      for (const leftover of player.items.filter((it) => {
        const c = it.code.toLowerCase().trim()
        return c === 'hst' || c === 'vip' || c === 'msf'
      })) {
        this.removePlayerQuestItem(player, leftover)
      }
      clearQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_CUSTOM_3_113C | QUEST_FLAG_CUSTOM_4_113C,
      )
      this.setPlayerQuestFlag(
        player,
        'a2q6',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    }
  }
  // A1Q2: Kashya (`hcIdx === 150`, `D2Game.dll` `0x6FC9A9E0`) grants a free Act 1 Rogue Scout
  // mercenary once Blood Raven (`a1q2`) is defeated if the player currently has no alive mercenary (#1930).
  if (npc?.hcIdx === 150) {
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a1q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !hasQuestFlag113c(player.questFlags, 'a1q2', QUEST_FLAG_CUSTOM_9_113C)
    ) {
      this.setPlayerQuestFlag(
        player,
        'a1q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_9_113C,
      )
      this.grantFreeQuestMercenary113c(player, 1)
    }
  }
  // A1Q3: Akara (`hcIdx === 148`) translates the Scroll of Inifuss ('bks') into the Key to the Cairn Stones ('bkd'),
  // and rewards an identified Rare Ring (`ilvl 9/39/65`, `D2Game.dll` `0x6FC9D269`) after Cain is rescued (#1930).
  if (npc?.hcIdx === 148) {
    const scroll = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'bks',
    )
    if (scroll !== undefined) {
      this.removePlayerQuestItem(player, scroll)
      this.givePlayerInventoryQuestItem(player, 'bkd', npc)
      this.setPlayerQuestFlag(player, 'a1q3', QUEST_FLAG_STARTED_113C)
    }
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a1q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !hasQuestFlag113c(player.questFlags, 'a1q3', QUEST_FLAG_CUSTOM_9_113C)
    ) {
      const a1q3RingIlvl = this.difficulty === 2 ? 65 : this.difficulty === 1 ? 39 : 9
      this.setPlayerQuestFlag(
        player,
        'a1q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_9_113C,
      )
      this.grantQuestRareItem113c(player, 'rin', a1q3RingIlvl, npc)
    }
  }
  // A1Q5: Charsi (`hcIdx === 154`) consumes the Horadric Malus (`'hdm'`) on interaction (`D2Game.dll` `0x6FCA15E0`)
  // and unlocks the one-shot Imbue reward (`QUEST_FLAG_REWARD_PENDING_113C`) if not yet redeemed.
  if (npc?.hcIdx === 154) {
    const malus = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'hdm',
    )
    if (malus !== undefined) {
      this.removePlayerQuestItem(player, malus)
      if (
        !hasQuestFlag113c(
          player.questFlags,
          'a1q5',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      ) {
        this.setPlayerQuestFlag(
          player,
          'a1q5',
          QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C,
        )
      }
    }
  }
  // A3Q1 (`D2Game.dll` @ `0x6fd08b60..0x6fd08ea0`):
  // 1. Cain (`hcIdx === 245` in Act 3, or any Cain `hcIdx`):
  //    - Scroll 0x20f (`0x6fd08bb4..0x6fd08bf4`): holding 'j34' sets bit 2 (`0x0004`, `QUEST_FLAG_STARTED_113C`, `qstsa3q42`).
  //    - Scroll 0x213 (`0x6fd08bf7..0x6fd08c32`): holding 'g34' sets bit 4 (`0x0010`, `QUEST_FLAG_CUSTOM_4_113C`, `qstsa3q44`).
  if (
    npc?.hcIdx === 245 ||
    npc?.hcIdx === 146 ||
    npc?.hcIdx === 244 ||
    npc?.hcIdx === 246 ||
    npc?.hcIdx === 520
  ) {
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a3q1',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      const hasJ34 = player.items.some((item) => item.code.toLowerCase().trim() === 'j34')
      const hasG34 = player.items.some((item) => item.code.toLowerCase().trim() === 'g34')
      if (
        hasJ34 &&
        !hasQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_STARTED_113C)
      ) {
        this.setPlayerQuestFlag(player, 'a3q1', QUEST_FLAG_STARTED_113C)
      }
      if (
        hasG34 &&
        !hasQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_CUSTOM_4_113C)
      ) {
        this.setPlayerQuestFlag(player, 'a3q1', QUEST_FLAG_CUSTOM_4_113C)
      }
    }
  }
  // 2. Meshif (`hcIdx === 264` / `0x108` in Act 3, or `210` in Act 2; `0x6fd08e1e..0x6fd08ea0`, scroll 0x211):
  //    trades Jade Figurine ('j34') -> Golden Bird ('g34').
  if (npc?.hcIdx === 264 || npc?.hcIdx === 210) {
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a3q1',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      const figurine = player.items.find(
        (item) => item.code.toLowerCase().trim() === 'j34',
      )
      if (figurine !== undefined) {
        this.removePlayerQuestItem(player, figurine)
        if (!this.playerOrGroundHasQuestItem(player, 'g34')) {
          this.givePlayerInventoryQuestItem(player, 'g34', npc)
        }
        this.emitQuestFlagSync113c(player, 'a3q1')
      }
    }
  }
  // 3. Alkor (`hcIdx === 254` / `0xfe`, `0x6fd08c5a..0x6fd08dc0` & `0x6fd090ef`):
  //    - A3Q1: ONLY accepts Golden Bird ('g34', never 'j34'), mints Potion of Life ('xyz').
  //    - A3Q4 (#1927): MUST verify & consume Lam Esen's Tome ('bbb') in `player.items` before
  //      granting `+5` stat points (`a3q4` completion); never awards empty-handed claims.
  if (npc?.hcIdx === 254) {
    const a3q1Idx = questWordIndex113c('a3q1')
    let a3q1Bits = a3q1Idx === undefined ? 0 : (player.questFlags[a3q1Idx] ?? 0)
    const goldenBird = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'g34',
    )
    if (
      goldenBird !== undefined &&
      (a3q1Bits & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C)) === 0
    ) {
      this.removePlayerQuestItem(player, goldenBird)
      this.setPlayerQuestFlag(player, 'a3q1', QUEST_FLAG_REWARD_PENDING_113C)
      a3q1Bits = a3q1Idx === undefined ? 0 : (player.questFlags[a3q1Idx] ?? 0)
    }
    if (
      (a3q1Bits & QUEST_FLAG_COMPLETED_113C) === 0 &&
      (a3q1Bits & QUEST_FLAG_REWARD_PENDING_113C) !== 0
    ) {
      if (a3q1Idx !== undefined) {
        player.questFlags[a3q1Idx] = a3q1Bits & ~QUEST_FLAG_REWARD_PENDING_113C
      }
      if (!this.playerOrGroundHasQuestItem(player, 'xyz')) {
        this.givePlayerInventoryQuestItem(player, 'xyz', npc)
      }
      this.setPlayerQuestFlag(
        player,
        'a3q1',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C | QUEST_FLAG_CUSTOM_5_113C,
      )
    }
    const tome = player.items.find((item) => item.code.toLowerCase().trim() === 'bbb')
    if (tome !== undefined && !hasQuestFlag113c(player.questFlags, 'a3q4', QUEST_FLAG_COMPLETED_113C)) {
      this.removePlayerQuestItem(player, tome)
      const a3q4Idx = questWordIndex113c('a3q4')
      for (const recipient of this.getQuestEligiblePartyRecipients113c(player, player.areaId)) {
        if (hasQuestFlag113c(recipient.questFlags, 'a3q4', QUEST_FLAG_COMPLETED_113C)) continue
        if (a3q4Idx !== undefined) {
          recipient.questFlags[a3q4Idx] =
            (recipient.questFlags[a3q4Idx] ?? 0) & ~QUEST_FLAG_REWARD_PENDING_113C
        }
        this.setPlayerQuestFlag(
          recipient,
          'a3q4',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      }
    }
  }
  // Quest turn-ins handled by the canonical NPC.
  if (npc?.hcIdx === 255) {
    // Ormus (`hcIdx === 255`, `D2Game.dll` `0x6FD060E0`): accepts the Gidbinn dagger ('g33')
    // and grants an identified Rare Ring (`ilvl 21/49/75`, #1930).
    const dagger = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'g33',
    )
    if (dagger !== undefined) {
      this.removePlayerQuestItem(player, dagger)
      for (const recipient of this.getQuestEligiblePartyRecipients113c(player, player.areaId)) {
        this.setPlayerQuestFlag(recipient, 'a3q2', QUEST_FLAG_COMPLETED_113C)
      }
    }
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a3q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !hasQuestFlag113c(player.questFlags, 'a3q2', QUEST_FLAG_CUSTOM_10_113C)
    ) {
      const a3q2RingIlvl = this.difficulty === 2 ? 75 : this.difficulty === 1 ? 49 : 21
      this.setPlayerQuestFlag(
        player,
        'a3q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_10_113C,
      )
      this.grantQuestRareItem113c(player, 'rin', a3q2RingIlvl, npc)
    }
  } else if (npc?.hcIdx === 252) {
    // Asheara (`hcIdx === 252`, `D2Game.dll` `0x6FD06320`): grants a free Act 3 Iron Wolf
    // mercenary after Blade of the Old Religion (`a3q2`) if the player has no alive mercenary (#1930).
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a3q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !hasQuestFlag113c(player.questFlags, 'a3q2', QUEST_FLAG_CUSTOM_9_113C)
    ) {
      this.setPlayerQuestFlag(
        player,
        'a3q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_9_113C,
      )
      this.grantFreeQuestMercenary113c(player, 3)
    }
  } else if (npc?.hcIdx === 512) {
    // Town Anya (`hcIdx === 512`, `D2Game.dll` `0x6FC7F956..0x6FC7FAC4`, #1929 / #2019):
    // rewards a class-specific identified Rare item (`ilvl = player.level`) from `ANYA_CLASS_REWARD_POOLS_113C`,
    // sets bits 9 & 10 (`0x0600`), and completes `a5q3` (`0x2001`, clearing `REWARD_PENDING`) once Malah's `'tr2'` bit 8 (`0x0100`) is also set (`0x6FC7FA8E`).
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_10_113C)
    ) {
      const tier: 0 | 1 | 2 =
        this.difficulty === 2 && player.level > 65
          ? 2
          : this.difficulty === 1 && player.level > 45
            ? 1
            : 0
      const classPool =
        ANYA_CLASS_REWARD_POOLS_113C[tier]?.[player.classId] ??
        ANYA_CLASS_REWARD_POOLS_113C[0]?.[0] ??
        ['jav']
      const rewardCode = classPool[this.rng.rand(classPool.length)] ?? classPool[0]!
      this.grantQuestRareItem113c(player, rewardCode, Math.max(1, player.level), npc)
      if (hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_8_113C)) {
        clearQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)
        this.setPlayerQuestFlag(
          player,
          'a5q3',
          QUEST_FLAG_CUSTOM_9_113C |
            QUEST_FLAG_CUSTOM_10_113C |
            QUEST_FLAG_COMPLETED_113C |
            QUEST_FLAG_COMPLETED_NOW_113C,
        )
      } else {
        this.setPlayerQuestFlag(
          player,
          'a5q3',
          QUEST_FLAG_CUSTOM_9_113C | QUEST_FLAG_CUSTOM_10_113C,
        )
      }
    }
    this.syncHarrogathA5Q3State113c(player)
  } else if (npc?.hcIdx === 513) {
    // Malah (`hcIdx === 513`, `D2Game.dll` `0x6FC7DA70..0x6FC7DBAE`, `0x6FC7F5E0..0x6FC7F94A`, #2019):
    // 1) After Anya thaw (`REWARD_PENDING` set, `CUSTOM_8` clear): grants `'tr2'`, sets `CUSTOM_8` (`0x0100`),
    //    and finalizes `COMPLETED | COMPLETED_NOW` (`0x2001`, clearing `REWARD_PENDING`) ONLY if Town Anya's `CUSTOM_9` (`0x0200`) is already set (`0x6FC7F7CB`).
    // 2) Lost unconsumed `'tr2'` (`CUSTOM_8` set, `CUSTOM_7` clear, missing `'tr2'`): replaces once per game (`0x6FC7F89F..0x6FC7F94A`).
    // 3) Thawing potion `'ice'`: granted ONLY after Frozen Anya (`558`/`527`) is discovered (`CUSTOM_4` = `0x0010`, `0x6FC7DB44` / `0x6FC7F692`).
    // 4) `A5Q3Init` (`0x6FC7F625`, scroll `0x4E94`): after `a5q2` completion, starts `a5q3` (`0x0004`) without granting `'ice'`.
    const idx = questWordIndex113c('a5q3')
    const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
    if (
      (bits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 &&
      (bits & QUEST_FLAG_COMPLETED_113C) === 0 &&
      (bits & QUEST_FLAG_CUSTOM_8_113C) === 0
    ) {
      if (!this.playerOrGroundHasQuestItem(player, 'tr2')) {
        this.givePlayerInventoryQuestItem(player, 'tr2', npc)
      }
      if ((bits & QUEST_FLAG_CUSTOM_9_113C) !== 0) {
        clearQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)
        this.setPlayerQuestFlag(
          player,
          'a5q3',
          QUEST_FLAG_CUSTOM_8_113C | QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      } else {
        this.setPlayerQuestFlag(player, 'a5q3', QUEST_FLAG_CUSTOM_8_113C)
      }
      this.syncHarrogathA5Q3State113c(player)
    } else if (
      (bits & QUEST_FLAG_CUSTOM_8_113C) !== 0 &&
      (bits & QUEST_FLAG_CUSTOM_7_113C) === 0 &&
      !player.a5q3ReplacedTr2InGame &&
      !this.playerOrGroundHasQuestItem(player, 'tr2')
    ) {
      player.a5q3ReplacedTr2InGame = true
      this.givePlayerInventoryQuestItem(player, 'tr2', npc)
    } else if (
      (bits & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C)) === 0 &&
      (bits & QUEST_FLAG_CUSTOM_4_113C) !== 0 &&
      !this.playerOrGroundHasQuestItem(player, 'ice')
    ) {
      clearQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_4_113C)
      this.givePlayerInventoryQuestItem(player, 'ice', npc)
      this.setPlayerQuestFlag(
        player,
        'a5q3',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
      )
    } else if (
      (bits &
        (QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_REWARD_PENDING_113C |
          QUEST_FLAG_STARTED_113C |
          QUEST_FLAG_CUSTOM_3_113C |
          QUEST_FLAG_CUSTOM_4_113C)) ===
        0 &&
      hasQuestFlag113c(
        player.questFlags,
        'a5q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      this.setPlayerQuestFlag(player, 'a5q3', QUEST_FLAG_STARTED_113C)
    }
  } else if (npc?.hcIdx === 527) {
    // Frozen Anya (drehyaiced, hcIdx 527, D2Game.dll 0x6FC7FAC9..0x6FC7FB2B, #1929 / #2019):
    // before thawing, records Frozen Anya discovered (`CUSTOM_4` = `0x0010`) and emits A5Q3FoundAnyaAnya (20131);
    // holding Malah's potion ('ice') thaws Anya, sets a5q3 reward pending, and updates Harrogath.
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      const potion = player.items.find((item) => item.code.toLowerCase().trim() === 'ice')
      if (potion !== undefined) {
        this.removePlayerQuestItem(player, potion)
        for (const recipient of this.getQuestEligiblePartyRecipients113c(player, player.areaId)) {
          if (hasQuestFlag113c(recipient.questFlags, 'a5q3', QUEST_FLAG_COMPLETED_113C)) continue
          clearQuestFlag113c(
            recipient.questFlags,
            'a5q3',
            QUEST_FLAG_CUSTOM_4_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
          )
          this.setPlayerQuestFlag(
            recipient,
            'a5q3',
            QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
          )
        }
        this.syncHarrogathA5Q3State113c(player)
      } else {
        for (const recipient of this.getQuestEligiblePartyRecipients113c(player, player.areaId)) {
          if (
            hasQuestFlag113c(
              recipient.questFlags,
              'a5q3',
              QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
            )
          ) {
            continue
          }
          this.setPlayerQuestFlag(
            recipient,
            'a5q3',
            QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_4_113C,
          )
        }
        const skipDuplicateFrozenAnyaInfo =
          !fromInteractPacket && player.lastNpcInteractHandshakeId === npcId
        if (!skipDuplicateFrozenAnyaInfo) {
          this.emitToPlayer(player.unitId, {
            type: 'Npc',
            kind: 'info',
            unitType: 1,
            npcId: npc.unitId,
            unitId: npc.unitId,
            count: 1,
            messages: [{ menu: 0, stringId: 20131 }],
            allMessages: [{ menu: 0, stringId: 20131 }],
          })
        }
      }
    }
  } else if (
    npc?.hcIdx === 515 ||
    npc?.hcIdx === 146 ||
    npc?.hcIdx === 244 ||
    npc?.hcIdx === 245 ||
    npc?.hcIdx === 246 ||
    npc?.hcIdx === 265 ||
    npc?.hcIdx === 520
  ) {
    const turnInQuests = npc.hcIdx === 515 ? (['a5q2'] as const) : (['a4q2'] as const)
    for (const turnInQuest of turnInQuests) {
      const idx = questWordIndex113c(turnInQuest)
      const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
      if (
        (bits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 &&
        (bits & QUEST_FLAG_COMPLETED_113C) === 0
      ) {
        if (idx !== undefined) {
          player.questFlags[idx] = bits & ~QUEST_FLAG_REWARD_PENDING_113C
        }
        this.setPlayerQuestFlag(
          player,
          turnInQuest,
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      } else if (
        turnInQuest === 'a4q2' &&
        npc.hcIdx === 246 &&
        player.areaId === 103 &&
        this.hellforgeState === 0 &&
        (bits & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C)) === 0 &&
        !this.playerOrGroundHasQuestItem(player, 'mss')
      ) {
        // D2Game.dll 0x6fcdaad3..0x6fcdab13: Act 4 Cain mints Mephisto's Soulstone ('mss') if missing before placing on the forge.
        this.givePlayerInventoryQuestItem(player, 'mss', npc)
        this.setPlayerQuestFlag(player, 'a4q2', QUEST_FLAG_STARTED_113C)
      }
    }
  }
  // D2Game.dll 0x6fc7d920 (`ACT5Q6_Callback02_NpcActivate`): talking to `tyrael3` (#521) in Worldstone Chamber (132)
  // spawns `"Destruction's End"` (`LastPortal` #565) in `OBJMODE_OPENED (2)` at `(npc.x + 5, npc.y)`.
  if (
    npc?.hcIdx === 521 &&
    hasQuestFlag113c(
      player.questFlags,
      'a5q6',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
  ) {
    const existingLastPortal = [...this.objects.values()].find(
      (o) => o.areaId === player.areaId && o.classId === 565,
    )
    if (existingLastPortal !== undefined) {
      this.setObjectMode(existingLastPortal, 2)
    } else {
      this.spawnObject({
        classId: 565,
        x: npc.x + 5,
        y: npc.y,
        areaId: player.areaId,
        mode: 2,
      })
    }
  }
  // D2Game.dll `ACT4Q1_NpcActivate` (`0x6fcda68f..0x6fcda7e6`, #2011):
  // - `izualghost` (`hcIdx === 406`): sets `QUEST_FLAG_CUSTOM_5_113C` (`0x0020`, `A4Q1SuccessfulIzual`)
  //   when `a4q1` is reward-pending or completed, advancing Plains of Despair quest log `3 -> 4`.
  // - `tyrael2` (`hcIdx === 367`): when `a4q1` has `QUEST_FLAG_REWARD_PENDING_113C` (`0x0002`),
  //   clears `0x0002` and sets `0x2001` (`COMPLETED | COMPLETED_NOW`), granting `+2` `STAT_NEWSKILLS`
  //   and unlocking Act 4 vendor `10%` discount; otherwise sets `QUEST_FLAG_STARTED_113C` (`0x0004`).
  if (npc?.hcIdx === 406) {
    const idx = questWordIndex113c('a4q1')
    const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
    if (
      (bits & (QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_113C)) !== 0 &&
      (bits & QUEST_FLAG_CUSTOM_5_113C) === 0
    ) {
      this.setPlayerQuestFlag(player, 'a4q1', QUEST_FLAG_CUSTOM_5_113C)
    }
  }
  if (npc?.hcIdx === 367) {
    const idx = questWordIndex113c('a4q1')
    const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
    if (
      (bits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 &&
      (bits & QUEST_FLAG_COMPLETED_113C) === 0
    ) {
      if (idx !== undefined) {
        player.questFlags[idx] = bits & ~QUEST_FLAG_REWARD_PENDING_113C
      }
      this.setPlayerQuestFlag(
        player,
        'a4q1',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    } else if (
      (bits &
        (QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_REWARD_PENDING_113C |
          QUEST_FLAG_STARTED_113C)) ===
      0
    ) {
      this.setPlayerQuestFlag(player, 'a4q1', QUEST_FLAG_STARTED_113C)
    }
  }
  // D2Game.dll `ACT4Q2_NpcActivate` (`0x6FCDB006..0x6FCDB06A`, #2018): talking to `tyrael2` (#367) after `a4q3`
  // (Diablo) completion computes `(tyrael.x + 5, tyrael.y)` (`add ebx, 0x5`) and calls `D2GAME_FindFreeCoords`
  // (`0x6FC54130`, `nSize = 2`, `mask = 0x400`, `maxRadius = 0x64 = 100`) before spawning `Harrogath` portal (#566).
  if (
    npc?.hcIdx === 367 &&
    hasQuestFlag113c(
      player.questFlags,
      'a4q3',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
  ) {
    const existingHarrogathPortal = [...this.objects.values()].find(
      (o) => o.areaId === player.areaId && o.classId === 566,
    )
    if (existingHarrogathPortal !== undefined) {
      this.setObjectMode(existingHarrogathPortal, 2)
    } else {
      const hasLoadedArea = this.loadedAreas.has(player.areaId)
      const rawPortalX = npc.x + 5
      const rawPortalY = npc.y
      const npcCellX = Math.round(npc.x)
      const npcCellY = Math.round(npc.y)
      const portalStand = hasLoadedArea
        ? (findStandableNear(
            (x, y) =>
              this.isWorldWalkableForPlayer(player.areaId, x, y) &&
              (x !== npcCellX || y !== npcCellY),
            rawPortalX,
            rawPortalY,
            100,
          ) ??
          findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
            rawPortalX,
            rawPortalY,
            100,
          ))
        : null
      if (!hasLoadedArea || portalStand !== null) {
        this.spawnObject({
          classId: 566,
          x: portalStand?.x ?? rawPortalX,
          y: portalStand?.y ?? rawPortalY,
          areaId: player.areaId,
          mode: 2,
        })
      }
    }
  }
  const canHeal =
    getTownNpcDescriptorByHcIdx(npc !== undefined ? npc.hcIdx : npcId)?.canHeal === true
  void healRequested
  if (canHeal) {
    // 1.13c D2Game.dll 0x6fcdd810 -> 0x6fcdd490 (NPC_HealPlayerAndPets):
    // Restores player STAT_HITPOINTS (6), STAT_MANA (8), and STAT_STAMINA (10) to accrued max
    // (0x6fc2a3a0 GetMaxLife / 0x6fc2a4ea GetMaxMana / 0x6fc2a460 GetMaxStamina) and sends
    // D2GAME_SendStatToClient (0x6fcec2f0) for each vital when current < max.
    // (0x6fcdcbe0 is the ally/pet callback passed to sub_6FCB6AF0 at 0x6fcdd5b1.)
    const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
    const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
    const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)
    player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
    player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
    player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))
    if (!player.dead && player.hpFixed < accruedMaxHpFixed) {
      player.hpFixed = accruedMaxHpFixed
    }
    if (!player.dead) {
      player.hp = Math.max(1, Math.floor(player.hpFixed / FIXED_ONE))
    }
    if (player.manaFixed < accruedMaxManaFixed) {
      player.manaFixed = accruedMaxManaFixed
    }
    player.mana = Math.max(0, Math.floor(player.manaFixed / FIXED_ONE))
    if (player.staminaFixed < accruedMaxStaminaFixed) {
      player.staminaFixed = accruedMaxStaminaFixed
    }
    player.staminaExhausted = false
    player.stamina = Math.max(0, Math.floor(player.staminaFixed / FIXED_ONE))
    // 0x6fcdc920 iterates States.txt with D2Common #10590 (curable == 1),
    // plus state 2 (poison) and state 1 (freeze).
    const combatCtx = this.playerCombat.get(player.unitId)
    for (const stateId of CURABLE_STATE_IDS_113C) {
      const hasState =
        player.states.has(stateId) || Boolean(combatCtx?.stateBus.hasState(stateId))
      if (hasState) {
        this.clearUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          stateId,
        )
        combatCtx?.stateBus.removeState(stateId)
      }
    }
    for (const [statId, value] of [
      [6, player.hpFixed],
      [8, player.manaFixed],
      [10, player.staminaFixed],
    ] as const) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId,
        value,
      })
    }
    this.emitPlayerVitals(player)
    // sub_6FCB6AF0 applies 0x6fcdcbe0 to player's mercenary and pets as well
    for (const merc of this.mercenaries.values()) {
      if (merc.ownerPlayerId === player.unitId && merc.alive) {
        merc.hp = merc.maxHp
        this.cleanseMercenaryCurableStates113c(merc)
        this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
      }
    }
    const mgr = this.summonManagers.get(player.unitId)
    if (mgr) {
      for (const pet of mgr.getActivePets()) {
        if (pet.alive !== false && pet.maxHp > 0) {
          pet.hp = pet.maxHp
          const petUnitId = this.petUnitIds.get(pet.uid)
          if (petUnitId !== undefined) {
            this.broadcastAllyHp(player.areaId, petUnitId, pet.hp)
          }
        }
        for (const stateId of CURABLE_STATE_IDS_113C) {
          if (pet.stateBus.hasState(stateId)) {
            pet.stateBus.removeState(stateId)
          }
        }
      }
    }
  }
  this.emitNpcTravelOptions(player, npc)
  if (fromInteractPacket) {
    player.lastNpcInteractHandshakeId = npcId
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: npcId,
      quests: new Uint16Array(player.questFlags),
      flags: Array.from(player.questFlags),
    })
  } else if (player.lastNpcInteractHandshakeId === npcId) {
    player.lastNpcInteractHandshakeId = undefined
  }
}



/** Quest flag required by a forward NPC travel action from the player's current act. */
function npcTravelQuestGate(this: GameInstanceHost, currentAct: number, action: string): string | undefined {
  if (action === 'travel_west') return undefined
  // Act 4 has 3 quests in 1.13c (`a4q1`, `a4q2`, `a4q3`); Terror's End (Diablo) is `a4q3` (word 26).
  if (action === 'travel_harrogath') return currentAct === 3 ? 'a4q3' : undefined
  if (action === 'travel_east') {
    if (currentAct === 0) return 'a1q6'
    if (currentAct === 1) return 'a2q6'
    if (currentAct === 2) return 'a3q6'
  }
  return undefined
}



function npcTravelDestinationAct(this: GameInstanceHost, currentAct: number, action: string): number | undefined {
  if (action === 'travel_west') return currentAct > 0 ? currentAct - 1 : undefined
  if (action === 'travel_east' || action === 'travel_harrogath') {
    return currentAct + 1 < ACT_TOWN_AREAS.length ? currentAct + 1 : undefined
  }
  return undefined
}



/** S2C 0x61 CanGoToAct for travel NPCs (Warriv/Meshif/Tyrael), gated by act progression. */
function emitNpcTravelOptions(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npc: InternalMonsterRecord | undefined,
): void {
  if (!npc) return
  const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
  if (!descriptor?.travelActions?.length) return
  const currentAct = areaToAct(player.areaId)
  if (descriptor.actIndex !== currentAct) return
  for (const action of descriptor.travelActions) {
    const destAct = this.npcTravelDestinationAct(currentAct, action)
    if (destAct === undefined) continue
    const questId = this.npcTravelQuestGate(currentAct, action)
    if (questId !== undefined && !this.hasNpcTravelQuestCleared113c(player, questId)) {
      continue
    }
    this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: destAct })
  }
}



/** Warriv / Meshif / Tyrael travel complement -> next act town, gated by act progression. */
function handleNpcTravel(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  destAreaId: number,
): void {
  const npc = this.monsters.get(npcId)
  if (npc && (!npc.isNpc || npc.areaId !== player.areaId || !this.playerInNpcRange(player, npc))) {
    return
  }
  const descriptor = npc ? getTownNpcDescriptorByHcIdx(npc.hcIdx) : undefined
  if (npc && !descriptor?.travelActions?.length) {
    return
  }
  const currentAct = areaToAct(player.areaId)
  if (descriptor && descriptor.actIndex !== currentAct) return
  const destAct = areaToAct(destAreaId)
  // Travel NPCs only reach the destination act's main town, never a wild/dungeon area.
  if (ACT_TOWN_AREAS[destAct] !== destAreaId) return
  if (npc && !this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y)) {
    return
  }
  const action = descriptor?.travelActions?.find(
    (candidate) => this.npcTravelDestinationAct(currentAct, candidate) === destAct,
  )
  if (action === undefined) return
  const questId = this.npcTravelQuestGate(currentAct, action)
  if (questId !== undefined && !this.hasNpcTravelQuestCleared113c(player, questId)) {
    return
  }
  if (npc?.hcIdx === 155 && destAreaId === 40) {
    if (hasQuestFlag113c(player.questFlags, 'a1q6', QUEST_FLAG_COMPLETED_NOW_113C)) {
      this.setPlayerQuestFlag(
        player,
        'a1q6',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_4_113C,
      )
    } else if (!hasQuestFlag113c(player.questFlags, 'a1q6', QUEST_FLAG_COMPLETED_113C)) {
      this.setPlayerQuestFlag(player, 'a1q6', QUEST_FLAG_COMPLETED_113C)
    }
  }
  this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: destAct })
  if (!this.transitionPlayerArea(player, destAreaId, { kind: 'townPortal' })) {
    return
  }
  player.activeNpcId = undefined
}



/**
 * 1.13c store refresh (`D2Game.dll` `0x6FCB0320` `NPC_CheckTownEmptyAndRefresh` &
 * `0x6FCAF620` `NPC_DestroyPlayerGambleInventory`): leaving an area always clears the
 * leaving player's per-player gamble pools, and clears the town's shared NPC store
 * inventories (`pNpcRecord->pInventory` / `vendor.bItemsGenerated`) only when no
 * players remain in that town area.
 */
function clearVendorPools(this: GameInstanceHost, player: InternalPlayerRecord, prevAreaId?: number): void {
  for (const [npcId, pool] of player.vendorPools.entries()) {
    if (player.vendorPoolModes.get(npcId) === 'gamble') {
      for (const item of pool) this.gambleSourceItems.delete(item.unitId)
    }
  }
  for (const byMode of player.vendorPoolsByMode.values()) {
    for (const item of byMode.gamble ?? []) {
      this.gambleSourceItems.delete(item.unitId)
    }
  }
  player.vendorPools.clear()
  player.vendorPoolModes.clear()
  player.vendorPoolsByMode.clear()
  player.activeVendorMode = null

  if (prevAreaId !== undefined && TOWN_AREAS.has(prevAreaId)) {
    let townStillOccupied = false
    for (const other of this.players.values()) {
      if (other.areaId === prevAreaId) {
        townStillOccupied = true
        break
      }
    }
    if (!townStillOccupied) {
      for (const npc of this.monsters.values()) {
        if (npc.isNpc && npc.areaId === prevAreaId) {
          npc.vendorPool = []
          npc.vendorStoreGenerated = false
        }
      }
    }
  }
}



function handleNpcAction(this: GameInstanceHost, player: InternalPlayerRecord, npcId: number, gamble: boolean): void {
  const npc = this.monsters.get(npcId)
  if (
    npc &&
    (!npc.isNpc ||
      npc.areaId !== player.areaId ||
      !this.playerInNpcRange(player, npc) ||
      !this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y))
  ) {
    if (npc && npc.isNpc && npc.areaId === player.areaId && player.pendingInteraction === undefined) {
      player.pendingInteraction = { kind: 'npc', id: npcId }
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = gamble
    }
    return
  }
  player.pendingInteraction = undefined
  player.pendingInteractionSteps = 0
  player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
  player.activeNpcId = npcId
  if (npc !== undefined) {
    const introBit = NPC_INTRO_BIT_BY_HCIDX_113C.get(npc.hcIdx)
    if (introBit !== undefined && player.npcIntro.byteLength === 52) {
      const byteIdx = 4 + this.difficulty * 8 + (introBit >> 3)
      if (byteIdx >= 4 && byteIdx < 28) {
        player.npcIntro[byteIdx] = (player.npcIntro[byteIdx] ?? 0) | (1 << (introBit & 7))
      }
    }
  }
  if (!npc) return
  const mode: 'trade' | 'gamble' = gamble ? 'gamble' : 'trade'
  let byMode = player.vendorPoolsByMode.get(npcId)
  if (byMode === undefined) {
    byMode = {}
    player.vendorPoolsByMode.set(npcId, byMode)
  }
  let pool: ServerItemEntry[]
  if (mode === 'gamble') {
    // 1.13c D2Game `0x6FCDE2A0` (`NPC_FillGamble`): gamble stock is per-player
    // (`pNpcRecord->pGambleList`) and regenerated every time the gamble window opens.
    if (byMode.gamble !== undefined) {
      for (const item of byMode.gamble) {
        this.gambleSourceItems.delete(item.unitId)
      }
    }
    pool = this.createVendorStorePool(npc, player, true)
    byMode.gamble = pool
    player.vendorPools.set(npcId, pool)
    player.vendorPoolModes.set(npcId, 'gamble')
  } else {
    // 1.13c D2Game `0x6FCDF730` (`NPC_InitStoreOrGamble`): normal vendor stock lives
    // on `pNpcRecord->pInventory` (`vendor.bItemsGenerated`) and is shared across
    // players in town until the last player leaves that town area (`0x6FCB0320`).
    if (!npc.vendorStoreGenerated) {
      npc.vendorPool = this.createVendorStorePool(npc, player, false)
      npc.vendorStoreGenerated = true
    }
    pool = npc.vendorPool
    byMode.trade = pool
    player.vendorPools.set(npcId, pool)
    player.vendorPoolModes.set(npcId, 'trade')
  }
  player.activeVendorMode = mode
  if (mode === 'trade' || !npc.vendorStoreGenerated) {
    npc.vendorPool = pool
  }

  for (const vItem of pool) {
    if (mode === 'trade' && vItem.buyback !== true) {
      vItem.cost = this.serverItemPrice113c(player, npc.hcIdx, vItem, 0)
    }
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'vendorPool',
      itemId: vItem.unitId,
      code: vItem.code,
      x: vItem.x,
      y: vItem.y,
      container: 'shop',
      item: this.serverEntryToItemData(vItem),
    })
  }
}



/** Remove a bought non-permanent store entry from the shop and notify viewing clients. */
function removeVendorPoolEntry(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npc: InternalMonsterRecord,
  npcId: number,
  itemId: number,
): void {
  const owned = player.vendorPools.get(npcId)
  if (owned) {
    const idx = owned.findIndex((entry) => entry.unitId === itemId)
    if (idx !== -1) owned.splice(idx, 1)
  }
  if (npc.vendorPool !== owned) {
    const npcIdx = npc.vendorPool.findIndex((entry) => entry.unitId === itemId)
    if (npcIdx !== -1) npc.vendorPool.splice(npcIdx, 1)
  }
  this.emitToPlayer(player.unitId, {
    type: 'UnitRemove',
    unitType: 4,
    id: itemId,
    unitId: itemId,
  })
  if (player.activeVendorMode === 'trade') {
    for (const other of this.players.values()) {
      if (
        other.unitId !== player.unitId &&
        other.areaId === npc.areaId &&
        other.activeNpcId === npcId &&
        other.activeVendorMode === 'trade'
      ) {
        this.emitToPlayer(other.unitId, {
          type: 'UnitRemove',
          unitType: 4,
          id: itemId,
          unitId: itemId,
        })
      }
    }
  }
}



function handleNpcBuy(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  itemId: number,
  isGamble: boolean,
  explicitCost?: number,
  shiftFill = false,
): void {
  const npc = this.monsters.get(npcId)
  if (!npc || !npc.isNpc || npc.areaId !== player.areaId) return
  const pool = player.vendorPools.get(npcId) ?? npc.vendorPool
  const vItem = pool.find((i) => i.unitId === itemId)
  // Synthetic test fixtures (`giveVendorPool`) populate `npc.vendorPool` directly
  // with `rawItemData === undefined` without opening a trade window via `NpcAction`.
  const isSyntheticVendorFixture =
    !isGamble &&
    vItem !== undefined &&
    vItem.rawItemData === undefined &&
    !player.vendorPools.has(npcId) &&
    player.activeNpcId === undefined &&
    player.activeVendorMode === null
  if (!isSyntheticVendorFixture) {
    // 1.13c trade context: the requested NPC must be the one currently open,
    // within reach, and the window type must match the request. A closed window
    // (activeNpcId / activeVendorMode cleared) rejects the transaction.
    if (player.activeNpcId !== npcId) return
    if (!this.playerInNpcRange(player, npc)) return
    if (player.activeVendorMode === null) return
    if ((player.activeVendorMode === 'gamble') !== isGamble) return
  }
  // Gamble previews live in `gambleSourceItems`, not the normal store pool.
  const gambleSource = isGamble ? this.gambleSourceItems.get(itemId) : undefined
  // #1337/#1354: no fallback item — a stale/unknown item id or another player's gamble item rejects the transaction.
  if (isGamble ? !gambleSource || (pool.length > 0 && !vItem) : !vItem) return
  const code = vItem?.code ?? gambleSource?.base.id
  if (!code) return
  const info = getBaseSizeTable().get(code.trim())
  if (!info) return
  void explicitCost
  // Server-owned price; the client's 0x32 `cost` field is informational only.
  let cost: number
  if (vItem) {
    if (vItem.buyback === true || (!isGamble && vItem.rawItemData === undefined)) {
      cost = vItem.cost
    } else {
      try {
        cost = this.serverItemPrice113c(player, npc.hcIdx, vItem, isGamble ? 2 : 0)
      } catch {
        return
      }
    }
  } else if (isGamble && gambleSource) {
    try {
      cost = computeTransactionCost113c(
        {
          code,
          itemFormat: 1,
          quality: 2,
          identified: false,
          ethereal: false,
          starterItem: false,
          isEar: false,
          stats: [],
          socketedChildCodes: [],
        },
        this.transactionCostContext(player, npc.hcIdx),
        2,
      )
    } catch {
      return
    }
  } else {
    return
  }

  // 1.13c placement: potions/tomes are independent items; scrolls merge into
  // an unfilled tome; keys/arrows/bolts merge up to their MaxStack.
  const lowerCode = code.trim().toLowerCase()
  const beltCatalogEntry = BELT_POTION_CATALOG[lowerCode]
  const isBeltable = beltCatalogEntry !== undefined
  const isScroll = lowerCode === 'tsc' || lowerCode === 'isc'
  const tomeCode = lowerCode === 'tsc' ? 'tbk' : lowerCode === 'isc' ? 'ibk' : undefined
  const mergeMax =
    lowerCode === 'key'
      ? 12
      : lowerCode === 'aqv'
        ? 350
        : lowerCode === 'cqv'
          ? 250
          : lowerCode === 'abv'
            ? 500
            : isScroll
              ? 20
              : 0
  let stackTarget: ServerItemEntry | undefined
  if (isScroll && tomeCode !== undefined) {
    stackTarget = player.items.find(
      (item) =>
        item.location === 'inventory' &&
        item.code.trim().toLowerCase() === tomeCode &&
        Math.max(0, Math.trunc(item.quantity ?? 0)) < 20,
    )
  } else if (mergeMax > 0) {
    stackTarget = player.items.find(
      (item) =>
        item.location === 'inventory' &&
        item.code.trim().toLowerCase() === lowerCode &&
        Math.max(1, Math.trunc(item.quantity || 1)) < mergeMax,
    )
  }
  let beltSlot: { x: number; y: number } | undefined
  if (stackTarget === undefined && isBeltable) {
    beltSlot = this.findAvailableBeltSlot(player, lowerCode)
  }
  const free =
    stackTarget === undefined && beltSlot === undefined
      ? this.findFreeGridSlot(
          player,
          'inventory',
          vItem?.width ?? info.width,
          vItem?.height ?? info.height,
          10,
          4,
        )
      : (beltSlot ?? { x: 0, y: 0 })
  if (!stackTarget && !beltSlot && !free) {
    this.emitToPlayer(player.unitId, {
      type: 'NpcTransaction',
      result: 0x01,
      flag: 0,
      itemId,
      gold: player.gold,
    })
    return
  }
  const cell = free ?? beltSlot!

  const totalGold = player.gold + player.goldBank
  if (totalGold < cost) {
    this.emitToPlayer(player.unitId, {
      type: 'NpcTransaction',
      result: 0x0c,
      flag: 0,
      itemId,
      gold: player.gold,
    })
    return
  }

  let spentFromBank = false
  const deductGold = (amountToDeduct: number): void => {
    if (player.gold >= amountToDeduct) {
      player.gold -= amountToDeduct
    } else {
      const rem = amountToDeduct - player.gold
      player.gold = 0
      player.goldBank = Math.max(0, player.goldBank - rem)
      if (rem > 0) spentFromBank = true
    }
  }

  const emitGoldUpdates = (): void => {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 14,
      value: player.gold,
    })
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      stat: 14,
      value: player.gold,
    })
    if (spentFromBank) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 15,
        value: player.goldBank,
      })
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        stat: 15,
        value: player.goldBank,
      })
    }
  }

  // 1.13c Shift+NpcBuy (`D2Game.dll` `0x6fcde980..0x6fcdec80`, flag `0x80000000`):
  // Bulk-fills unfilled tome/key/quiver stacks, buys a full key stack (`<= 12`) into empty inventory,
  // or fills available belt columns with the purchased potion/scroll capped by affordable gold.
  if (shiftFill && !isGamble) {
    const unitCost = Math.max(1, cost)
    if (stackTarget !== undefined) {
      const curQty = isScroll
        ? Math.max(0, Math.trunc(stackTarget.quantity ?? 0))
        : Math.max(1, Math.trunc(stackTarget.quantity || 1))
      const needed = Math.max(0, mergeMax - curQty)
      const affordable = Math.floor((player.gold + player.goldBank) / unitCost)
      const buyCount = vItem && !vItem.permStore ? Math.min(1, needed, affordable) : Math.min(needed, affordable)
      if (buyCount <= 0) return
      deductGold(buyCount * cost)
      this.syncServerItemQuantity(stackTarget, curQty + buyCount)
      if (vItem && !vItem.permStore) {
        this.removeVendorPoolEntry(player, npc, npcId, itemId)
      }
      emitGoldUpdates()
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        unit: { unitType: 4, id: stackTarget.unitId },
        stat: 70,
        value: stackTarget.quantity,
      })
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'update',
        itemId: stackTarget.unitId,
        code: stackTarget.code,
        x: stackTarget.x,
        y: stackTarget.y,
        container: 'inventory',
        item: this.serverEntryToItemData(stackTarget),
      })
      return
    }

    if (lowerCode === 'key' && free !== undefined) {
      const affordable = Math.floor((player.gold + player.goldBank) / unitCost)
      const buyCount = vItem && !vItem.permStore ? 1 : Math.max(1, Math.min(12, affordable))
      deductGold(buyCount * cost)
      const keyEntry: ServerItemEntry = vItem?.rawItemData
        ? this.cloneVendorEntryForPlayer(vItem, player, cell, 'inventory')
        : {
            unitId: this.allocateUnitId(UNIT_TYPE_113C.item),
            code,
            name: info.name,
            quality: vItem?.quality ?? 2,
            level: player.level,
            location: 'inventory',
            x: cell.x,
            y: cell.y,
            width: info.width,
            height: info.height,
            areaId: player.areaId,
            ownerId: player.unitId,
            bodyLoc: 0,
            storePage: 1,
            cost: info.cost,
            gamble: false,
            identified: true,
            ethereal: false,
            socketed: false,
            totalSockets: 0,
            durability: info.maxDurability,
            maxDurability: info.maxDurability,
            quantity: buyCount,
            stats: new Map([[70, buyCount]]),
            socketedItems: [],
          }
      this.syncServerItemQuantity(keyEntry, buyCount)
      player.items.push(keyEntry)
      if (vItem && !vItem.permStore) {
        this.removeVendorPoolEntry(player, npc, npcId, itemId)
      }
      emitGoldUpdates()
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'buy',
        itemId: keyEntry.unitId,
        code: keyEntry.code,
        x: keyEntry.x,
        y: keyEntry.y,
        container: 'inventory',
        item: this.serverEntryToItemData(keyEntry),
      })
      return
    }

    if (isBeltable && beltSlot !== undefined) {
      let nextSlot: { x: number; y: number } | undefined = beltSlot
      while (nextSlot !== undefined && player.gold + player.goldBank >= cost) {
        deductGold(cost)
        const potEntry: ServerItemEntry = vItem?.rawItemData
          ? this.cloneVendorEntryForPlayer(vItem, player, nextSlot, 'belt')
          : {
              unitId: this.allocateUnitId(UNIT_TYPE_113C.item),
              code,
              name: info.name,
              quality: vItem?.quality ?? 2,
              level: player.level,
              location: 'belt',
              x: nextSlot.x,
              y: nextSlot.y,
              width: info.width,
              height: info.height,
              areaId: player.areaId,
              ownerId: player.unitId,
              bodyLoc: 0,
              storePage: 0,
              cost: info.cost,
              gamble: false,
              identified: true,
              ethereal: false,
              socketed: false,
              totalSockets: 0,
              durability: info.maxDurability,
              maxDurability: info.maxDurability,
              quantity: 1,
              stats: new Map(),
              socketedItems: [],
            }
        const linearSlot = this.setBeltEntryColRow(potEntry, nextSlot.x, nextSlot.y)
        player.items.push(potEntry)
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'beltPut',
          itemId: potEntry.unitId,
          code: potEntry.code,
          x: linearSlot,
          y: 0,
          container: 'belt',
          item: this.serverEntryToItemData(potEntry),
        })
        if (vItem && !vItem.permStore) {
          this.removeVendorPoolEntry(player, npc, npcId, itemId)
          break
        }
        nextSlot = this.findAvailableBeltSlot(player, lowerCode)
      }
      emitGoldUpdates()
      return
    }
  }

  deductGold(cost)

  if (stackTarget !== undefined) {
    const prevQty = isScroll
      ? Math.max(0, Math.trunc(stackTarget.quantity ?? 0))
      : Math.max(1, Math.trunc(stackTarget.quantity || 1))
    this.syncServerItemQuantity(stackTarget, prevQty + 1)
    if (vItem && !vItem.permStore && !isGamble) {
      this.removeVendorPoolEntry(player, npc, npcId, itemId)
    }
    emitGoldUpdates()
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: stackTarget.unitId },
      stat: 70,
      value: stackTarget.quantity,
    })
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'update',
      itemId: stackTarget.unitId,
      code: stackTarget.code,
      x: stackTarget.x,
      y: stackTarget.y,
      container: 'inventory',
      item: this.serverEntryToItemData(stackTarget),
    })
    return
  }

  let quality = vItem?.quality ?? 2
  const stats = new Map<number, number>()
  if (isGamble) {
    const roll = this.rng.rand(100)
    quality = roll < 10 ? 6 : 4
    stats.set(0, 2 + this.rng.rand(5))
  }

  const purchased: ServerItemEntry =
    gambleSource
      ? // 1.13c gamble purchase: the mystery base is revealed as a Magic/Rare/Set/Unique item.
        this.createServerEntryFromItem(
          finalizeDroppedItem113c(
            resolveGambledItem({
              mysteryItem: gambleSource,
              cLvl: player.level,
              tables: getEmbeddedDropTables(),
              rng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
              spawnedUniqueIds: this.spawnedUniqueIds,
            }),
          ),
          {
            location: beltSlot ? 'belt' : 'inventory',
            x: cell.x,
            y: cell.y,
            areaId: player.areaId,
            ownerId: player.unitId,
            storePage: beltSlot ? 0 : 1,
            gamble: true,
          },
        )
      : vItem?.rawItemData && !isGamble
        ? // Store purchase: the bought item is the rolled store item itself.
          this.cloneVendorEntryForPlayer(vItem, player, cell, beltSlot ? 'belt' : 'inventory')
        : {
            unitId: this.allocateUnitId(UNIT_TYPE_113C.item),
            code,
            name: info.name,
            quality,
            level: player.level,
            location: beltSlot ? 'belt' : 'inventory',
            x: cell.x,
            y: cell.y,
            width: info.width,
            height: info.height,
            areaId: player.areaId,
            ownerId: player.unitId,
            bodyLoc: 0,
            storePage: beltSlot ? 0 : 1,
            cost: info.cost,
            gamble: isGamble,
            identified: true,
            ethereal: false,
            socketed: false,
            totalSockets: 0,
            durability: info.maxDurability,
            maxDurability: info.maxDurability,
            quantity: 1,
            stats,
            socketedItems: [],
          }
  if (beltSlot) {
    this.setBeltEntryColRow(purchased, beltSlot.x, beltSlot.y)
  }
  player.items.push(purchased)

  if (isGamble) {
    this.gambleSourceItems.delete(itemId)
    this.removeVendorPoolEntry(player, npc, npcId, itemId)
  } else if (vItem && !vItem.permStore) {
    this.removeVendorPoolEntry(player, npc, npcId, itemId)
  }

  emitGoldUpdates()
  const purchasedLinearX = beltSlot ? (beltSlot.y * 4 + beltSlot.x) & 0x0f : purchased.x
  const purchasedY = beltSlot ? 0 : purchased.y
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: isGamble ? 'gamble' : 'buy',
    itemId: purchased.unitId,
    code: purchased.code,
    x: purchasedLinearX,
    y: purchasedY,
    container: beltSlot ? 'belt' : 'inventory',
    item: this.serverEntryToItemData(purchased),
  })
}



/**
 * 1.13c two-pass belt auto-placement (`INVENTORY_GetFreeBeltSlot` / `BELTS_GetMaxRows`):
 * Pass 1 fills the lowest empty upper row (`1..beltRows-1`) above a compatible base slot (`y = 0`);
 * Pass 2 fills the first empty base slot (`y = 0, x = 0..3`).
 */
function findAvailableBeltSlot(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  lowerCode: string,
): { x: number; y: number } | undefined {
  const newCatalog = BELT_POTION_CATALOG[lowerCode]
  if (!newCatalog) return undefined
  const beltRows = this.getPlayerBeltMaxRows(player)
  const newPot = { ...newCatalog, id: lowerCode }

  // Pass 1: stack above an existing compatible potion/scroll in row 0.
  for (let bx = 0; bx < 4; bx++) {
    const baseItem = player.items.find((it) => {
      if (it.location !== 'belt') return false
      const pos = this.getBeltColRow(it)
      return pos.col === bx && pos.row === 0
    })
    if (!baseItem) continue
    const baseCode = baseItem.code.trim().toLowerCase()
    const baseCatalog = BELT_POTION_CATALOG[baseCode]
    if (!baseCatalog) continue
    if (!areBeltPotionsCompatible({ ...baseCatalog, id: baseCode }, newPot)) continue
    for (let by = 1; by < beltRows; by++) {
      const occupied = player.items.some((it) => {
        if (it.location !== 'belt') return false
        const pos = this.getBeltColRow(it)
        return pos.col === bx && pos.row === by
      })
      if (!occupied) {
        return { x: bx, y: by }
      }
    }
  }

  // Pass 2: place into the first empty base column (row 0).
  for (let bx = 0; bx < 4; bx++) {
    const occupied = player.items.some((it) => {
      if (it.location !== 'belt') return false
      const pos = this.getBeltColRow(it)
      return pos.col === bx && pos.row === 0
    })
    if (!occupied) {
      return { x: bx, y: 0 }
    }
  }
  return undefined
}



/** First free 10x10 cell on a vendor tab that fits the item footprint. */
function findFreeVendorSlot(this: GameInstanceHost, 
  pool: readonly ServerItemEntry[],
  page: number,
  width: number,
  height: number,
): { x: number; y: number } | undefined {
  const occupied = new Uint8Array(100)
  for (const other of pool) {
    if (other.storePage !== page) continue
    for (let yy = 0; yy < other.height; yy++) {
      for (let xx = 0; xx < other.width; xx++) {
        const gx = other.x + xx
        const gy = other.y + yy
        if (gx >= 0 && gx < 10 && gy >= 0 && gy < 10) occupied[gy * 10 + gx] = 1
      }
    }
  }
  for (let y = 0; y <= 10 - height; y++) {
    for (let x = 0; x <= 10 - width; x++) {
      let free = true
      for (let yy = 0; yy < height && free; yy++) {
        for (let xx = 0; xx < width; xx++) {
          if (occupied[(y + yy) * 10 + x + xx] !== 0) {
            free = false
            break
          }
        }
      }
      if (free) return { x, y }
    }
  }
  return undefined
}



function handleNpcSell(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
  itemId: number,
): void {
  const idx = this.findPlayerItemIndex(player, itemId)
  if (idx === -1) return
  const sold = player.items[idx]
  if (!sold) return
  const npc = this.monsters.get(npcId)
  if (!npc || !npc.isNpc || npc.areaId !== player.areaId) return
  if (player.activeNpcId !== npcId) return
  if (!this.playerInNpcRange(player, npc)) return
  if (player.activeVendorMode !== 'trade') return
  // 1.13c vendors only buy items carried in the inventory (not equipped, belt,
  // cursor, stash, cube or sockets), and never quest items or player ears
  // (`D2Common.#10705` `0x6FD741D0`).
  if (sold.location !== 'inventory') return
  const tables = getEmbeddedDropTables()
  const base = tables.getBase(sold.code.trim())
  const codeLower = sold.code.trim().toLowerCase()
  const rawFlags = Number(sold.rawItemData?.flags ?? 0)
  const isUnsellable =
    lookupBaseInfo(sold.code).quest ||
    (base?.quest ?? 0) > 0 ||
    base?.type?.trim().toLowerCase() === 'ques' ||
    codeLower === 'play' ||
    (rawFlags & 0x1000) !== 0
  if (isUnsellable) {
    if (npc) {
      this.emitToPlayer(player.unitId, {
        type: 'NpcTransaction',
        result: 0x09,
        flag: 0,
        itemId,
        gold: player.gold,
      })
    }
    return
  }

  // D2Common #10107 sell price (client `priceItem113c` type 1).
  let sellValue: number
  try {
    sellValue = this.serverItemPrice113c(player, npc.hcIdx, sold, 1)
  } catch {
    return
  }
  const maxInventoryGold = getInventoryGoldLimit(player.level)
  const maxBankGold = getStashGoldLimit(player.level)
  const room = Math.max(0, maxInventoryGold - player.gold)
  const bankRoom = Math.max(0, maxBankGold - player.goldBank)
  if (sellValue > room + bankRoom) {
    this.emitToPlayer(player.unitId, {
      type: 'NpcTransaction',
      result: 0x0c,
      flag: 0,
      itemId,
      gold: player.gold,
    })
    return
  }
  const soldFromContainer = toItemContainer(sold.location)
  const soldFromX = sold.x
  const soldFromY = sold.y
  const soldDeletedBase = this.serverEntryToItemData(sold)
  const soldDeletedFlags = ((soldDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
  player.items.splice(idx, 1)
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'sell',
    itemId: sold.unitId,
    code: sold.code,
    x: soldFromX,
    y: soldFromY,
    container: soldFromContainer,
    item: {
      ...soldDeletedBase,
      flags: soldDeletedFlags,
      rawFlags: soldDeletedFlags,
    },
  })
  const toInventory = Math.min(sellValue, room)
  player.gold += toInventory
  const overflow = sellValue - toInventory
  if (overflow > 0) {
    player.goldBank = Math.min(
      getStashGoldLimit(player.level),
      player.goldBank + overflow,
    )
  }
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 14,
    value: player.gold,
  })
  if (overflow > 0) {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 15,
      value: player.goldBank,
    })
  }

  const soldCodeLower = sold.code.trim().toLowerCase()
  const soldQual = this.normalizeItemQualityCode113c(
    sold.rawItemData?.quality ?? sold.quality,
  )
  const isStoneOfJordan =
    soldCodeLower === 'rin' &&
    soldQual === 7 &&
    (sold.rawItemData?.uniqueItemId === 122 ||
      sold.name.trim().toLowerCase() === 'the stone of jordan')

  // 1.13c buyback (`D2Game.dll` `NPC_SellItem` `0x6FCDF990`): non-ethereal,
  // non-broken, non-personalized, unsocketed items that are not already stocked
  // as a permanent store item (and not `The Stone of Jordan` World Event trigger)
  // enter this customer's vendor stock on their `ItemTypes.txt` storePage.
  if (npc) {
    let pool = player.vendorPools.get(npcId)
    if (pool === undefined) {
      pool = npc.vendorPool
      player.vendorPools.set(npcId, pool)
    }
    const isBroken = sold.maxDurability > 0 && sold.durability <= 0
    const isEthereal =
      sold.ethereal ||
      sold.rawItemData?.ethereal === true ||
      (rawFlags & 0x400000) !== 0
    const isPersonalized =
      sold.rawItemData?.personalized === true ||
      (rawFlags & 0x01000000) !== 0
    const hasSocketedItems = sold.socketedItems.length > 0
    const alreadyPermStocked = pool.some(
      (entry) => entry.permStore === true && entry.code.trim() === sold.code.trim(),
    )
    if (
      !isStoneOfJordan &&
      !isBroken &&
      !isEthereal &&
      !isPersonalized &&
      !hasSocketedItems &&
      !alreadyPermStocked
    ) {
      // 1.13c buyback tabs: armor -> 1, weapons1 -> 2 (overflow weapons2 -> 3),
      // misc -> 4. Never reuse the player's inventory `storePage`.
      const storeKind = base === undefined ? 'misc' : resolveStorePageForBase(base, tables.itemTypes)
      const preferredPage = storeKind === 'armo' ? 1 : storeKind === 'weap' ? 2 : 4
      let page = preferredPage
      let slot = this.findFreeVendorSlot(pool, page, sold.width, sold.height)
      if (slot === undefined && storeKind === 'weap') {
        page = 3
        slot = this.findFreeVendorSlot(pool, page, sold.width, sold.height)
      }
      if (slot !== undefined) {
        sold.location = 'vendor'
        sold.ownerId = npcId
        sold.storePage = page
        sold.x = slot.x
        sold.y = slot.y
        sold.gamble = false
        sold.buyback = true
        sold.identified = true
        sold.cost = sellValue
        if (sold.maxDurability > 0) {
          sold.durability = sold.maxDurability
        }
        if (base !== undefined && base.maxStack > 1) {
          sold.quantity = base.maxStack
        }
        if (sold.rawItemData !== undefined) {
          sold.rawItemData = {
            ...sold.rawItemData,
            identified: true,
            durability: sold.durability,
            curDurability: sold.durability,
            quantity: sold.quantity,
            flags: Number(sold.rawItemData.flags ?? 0) | 0x10,
          }
        }
        pool.push(sold)
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'vendorPool',
          itemId: sold.unitId,
          code: sold.code,
          x: sold.x,
          y: sold.y,
          container: 'shop',
          item: this.serverEntryToItemData(sold),
        })
      }
    }
  }

  // 1.13c World Event (`D2Game.dll` `0x5A` `eventType = 0x11` & `0x12`, #1842):
  // Selling Unique `#122` `The Stone of Jordan` increments the realm/game SoJ counter and,
  // on Hell difficulty once `worldEventSojThreshold` is reached, triggers `"Diablo Walks the Earth"`.
  if (isStoneOfJordan) {
    this.sojSoldCount += 1
    const sojCounterEvent: ServerEvent = {
      type: 'Chat',
      kind: 'event',
      eventType: 0x11,
      subType: 0,
      color: 4,
      arg: this.sojSoldCount,
      text: `${this.sojSoldCount} Stones of Jordan Sold to Merchants`,
    }
    for (const peer of this.players.values()) {
      this.emitToPlayer(peer.unitId, sojCounterEvent)
    }
    if (
      this.difficulty === 2 &&
      !this.worldEventTriggered &&
      this.sojSoldCount >= this.worldEventSojThreshold
    ) {
      this.worldEventTriggered = true
      const walksEvent: ServerEvent = {
        type: 'Chat',
        kind: 'event',
        eventType: 0x12,
        subType: 0,
        color: 4,
        arg: 0,
        text: 'Diablo Walks the Earth',
      }
      for (const peer of this.players.values()) {
        this.emitToPlayer(peer.unitId, walksEvent)
      }
    }
  }
}



/**
 * 1.13c C2S `0x4F` `ClickButton` (`D2Game.dll` `0x6FC917E0`, #1669):
 * - `0x13` (`WithdrawGold`, stash -> inventory): rejects if `amount <= 0`, `amount > goldBank`,
 *   or `gold + amount > getInventoryGoldLimit(level)`.
 * - `0x14` (`DepositGold`, inventory -> stash): rejects if `amount <= 0` or `amount > gold`;
 *   deposits `min(amount, getStashGoldLimit(level) - goldBank)`.
 */
function handleClickButton(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  buttonId: number,
  rawAmount: number,
): void {
  if (player.dead) return
  const amount = Math.max(0, Math.floor(rawAmount))
  if (buttonId === 0x18) {
    this.handleCubeTransmute(player)
    return
  }
  if (
    buttonId === 0x02 ||
    buttonId === 0x03 ||
    buttonId === 0x04 ||
    buttonId === 0x07 ||
    buttonId === 0x08
  ) {
    this.handleTradeButton(player, buttonId, amount)
    return
  }
  if (buttonId === 0x13) {
    if (amount <= 0 || amount > player.goldBank) return
    const invCap = getInventoryGoldLimit(player.level)
    if (player.gold + amount > invCap) return
    player.goldBank -= amount
    player.gold += amount
  } else if (buttonId === 0x14) {
    if (amount <= 0 || amount > player.gold) return
    const stashCap = getStashGoldLimit(player.level)
    const deposit = Math.min(amount, Math.max(0, stashCap - player.goldBank))
    if (deposit <= 0) return
    player.gold -= deposit
    player.goldBank += deposit
  } else {
    return
  }
  for (const [statId, value] of [
    [14, player.gold],
    [15, player.goldBank],
  ] as const) {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId,
      value,
    })
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      stat: statId,
      value,
    })
  }
}

export interface NpcVendorsAndArtisansMethods {
  handleCursorArtisanService(player: InternalPlayerRecord, npcId: number, itemId: number): boolean
  handleArtisanService(player: InternalPlayerRecord, npcId: number, itemId: number): boolean
  normalizeItemQualityCode113c(rawQuality: unknown): number
  resolveServiceNpc(player: InternalPlayerRecord, npcId: number): InternalMonsterRecord | undefined
  serviceNpcWithCapability(player: InternalPlayerRecord, npcId: number, capability: 'canRepair' | 'canIdentify' | 'canHeal' | 'canHire' | 'canResurrectMerc'): InternalMonsterRecord | undefined
  spendGold(player: InternalPlayerRecord, cost: number): boolean
  resolveRefillableThrowingMaxStack113c(item: ServerItemEntry, tables: TransactionCostTables): number
  doesEntryNeedRepair113c(item: ServerItemEntry, tables: TransactionCostTables): boolean
  repairSingleItemEntry(item: ServerItemEntry, tables: TransactionCostTables): boolean
  handleNpcRepair(player: InternalPlayerRecord, npcId: number, itemId?: number): void
  identifyItem(player: InternalPlayerRecord, item: ServerItemEntry): void
  handleNpcIdentifyAll(player: InternalPlayerRecord, npcId: number): void
  handleNpcIdentifyItem(player: InternalPlayerRecord, npcId: number, itemId: number): void
  grantQuestRareItem113c(player: InternalPlayerRecord, code: string, ilvl: number, dropOrigin?: { readonly x: number; readonly y: number }): ServerItemEntry | undefined
  grantFreeQuestMercenary113c(player: InternalPlayerRecord, act: 1 | 3): boolean
  syncRogueEncampmentA1Q3State113c(triggerPlayer?: InternalPlayerRecord): void
  syncTowerCellarA1Q4State113c(areaId?: number, triggerPlayer?: InternalPlayerRecord): void
  syncLutGholeinAct2NpcState113c(triggerPlayer?: InternalPlayerRecord): void
  syncDurielsLairA2Q6State113c(areaId?: number, fallbackX?: number, fallbackY?: number, triggerPlayer?: InternalPlayerRecord): void
  syncKurastDocksAct3NpcState113c(triggerPlayer?: InternalPlayerRecord): void
  syncHarrogathA5Q3State113c(triggerPlayer?: InternalPlayerRecord): void
  syncFrozenRiverA5Q3State113c(triggerPlayer?: InternalPlayerRecord): void
  handleNpcHireList(player: InternalPlayerRecord, npcId: number): void
  handleNpcHire(player: InternalPlayerRecord, npcId: number, mercId: number): void
  handleMercResurrect(player: InternalPlayerRecord, npcId: number): void
  handleNpcInteract(player: InternalPlayerRecord, npcId: number, healRequested?: boolean | undefined, fromInteractPacket?: boolean | undefined): void
  npcTravelQuestGate(currentAct: number, action: string): string | undefined
  npcTravelDestinationAct(currentAct: number, action: string): number | undefined
  emitNpcTravelOptions(player: InternalPlayerRecord, npc: InternalMonsterRecord | undefined): void
  handleNpcTravel(player: InternalPlayerRecord, npcId: number, destAreaId: number): void
  clearVendorPools(player: InternalPlayerRecord, prevAreaId?: number): void
  handleNpcAction(player: InternalPlayerRecord, npcId: number, gamble: boolean): void
  removeVendorPoolEntry(player: InternalPlayerRecord, npc: InternalMonsterRecord, npcId: number, itemId: number): void
  handleNpcBuy(player: InternalPlayerRecord, npcId: number, itemId: number, isGamble: boolean, explicitCost?: number, shiftFill?: boolean | undefined): void
  findAvailableBeltSlot(player: InternalPlayerRecord, lowerCode: string): { x: number; y: number } | undefined
  findFreeVendorSlot(pool: readonly ServerItemEntry[], page: number, width: number, height: number): { x: number; y: number } | undefined
  handleNpcSell(player: InternalPlayerRecord, npcId: number, itemId: number): void
  handleClickButton(player: InternalPlayerRecord, buttonId: number, rawAmount: number): void
}

export const npcVendorsAndArtisansMethods: Record<keyof NpcVendorsAndArtisansMethods, unknown> = {
  handleCursorArtisanService,
  handleArtisanService,
  normalizeItemQualityCode113c,
  resolveServiceNpc,
  serviceNpcWithCapability,
  spendGold,
  resolveRefillableThrowingMaxStack113c,
  doesEntryNeedRepair113c,
  repairSingleItemEntry,
  handleNpcRepair,
  identifyItem,
  handleNpcIdentifyAll,
  handleNpcIdentifyItem,
  grantQuestRareItem113c,
  grantFreeQuestMercenary113c,
  syncRogueEncampmentA1Q3State113c,
  syncTowerCellarA1Q4State113c,
  syncLutGholeinAct2NpcState113c,
  syncDurielsLairA2Q6State113c,
  syncKurastDocksAct3NpcState113c,
  syncHarrogathA5Q3State113c,
  syncFrozenRiverA5Q3State113c,
  handleNpcHireList,
  handleNpcHire,
  handleMercResurrect,
  handleNpcInteract,
  npcTravelQuestGate,
  npcTravelDestinationAct,
  emitNpcTravelOptions,
  handleNpcTravel,
  clearVendorPools,
  handleNpcAction,
  removeVendorPoolEntry,
  handleNpcBuy,
  findAvailableBeltSlot,
  findFreeVendorSlot,
  handleNpcSell,
  handleClickButton,
}
