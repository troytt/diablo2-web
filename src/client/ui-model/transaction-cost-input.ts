/**
 * Builds D2Common 1.13c #10107 / #10071 pricing inputs from server item packets
 * (`src/client/ui-model/transaction-cost-input.ts`). Prices are display-only:
 * D2Game ignores the client cost field (buy 0x6fcdf200, sell 0x6fcef570).
 */

import { resolveOnlineItemReqLevel } from '../../common/items/item-bridge.ts'
import {
  computeRepairAllCost113c,
  computeTransactionCost113c,
  getCanonicalTransactionCostTables,
  type ItemQuality113c,
  type TransactionCostContext,
  type TransactionCostInput,
  type TransactionCostStat,
} from '../../common/items/transaction-cost.ts'
import type { ItemData } from '../../netproto/index.ts'
import type { ClientWorld } from '../world/client-world.ts'

/** ItemStatCost ids the item packet carries outside the property list. */
const STAT_ARMORCLASS = 31
const STAT_QUANTITY = 70
const STAT_DURABILITY = 72
const STAT_MAXDURABILITY = 73
/** `STAT_ITEM_REDUCEDPRICES`; read as a full (player + equipped items) stat by #10107. */
const STAT_ITEM_REDUCEDPRICES = 87
/** Body locations 1..12 used by the repair-all loop (0x6fd7a210 walks 13 slots, slot 0 unused). */
const REPAIR_ALL_SLOTS = 13

/**
 * Compact ("simple") item packets carry no quality field; the engine creates them
 * as `ITEMQUAL_NORMAL` (2) — potions, scrolls, keys, gems, gamble previews.
 */
const QUALITY_NORMAL: ItemQuality113c = 2
/** Item flag 0x02000000: packet stops after the item code (D2Common 0x6fd7a746). */
const ITEM_FLAG_CODE_ONLY = 0x02000000

export function itemToTransactionCostInput(
  item: ItemData,
  socketed: readonly ItemData[],
  type: 0 | 1 | 2 | 3 = 3,
): TransactionCostInput {
  let quality: ItemQuality113c
  if (item.quality !== undefined) quality = item.quality
  else if (item.simple) quality = QUALITY_NORMAL
  else if (type === 2 && (item.rawFlags & ITEM_FLAG_CODE_ONLY) !== 0) {
    // Gamble previews are sent code-only (flag 0x02000000, capture 09); the gamble branch
    // (0x6fd78f38 -> 0x6fd74840) prices from code, clvl and item format and never reads quality.
    quality = QUALITY_NORMAL
  } else throw new Error(`item #${item.id} (${item.code}) has no quality in its packet`)

  // Base list = fields the packet sends outside the property list; full = base + properties.
  const acc = new Map<string, { statId: number; param: number; value: number; base: number }>()
  const add = (statId: number, param: number, value: number, isBase: boolean): void => {
    const k = `${statId}:${param}`
    const cur = acc.get(k) ?? { statId, param, value: 0, base: 0 }
    cur.value += value
    if (isBase) cur.base += value
    acc.set(k, cur)
  }
  if (item.defense !== undefined) add(STAT_ARMORCLASS, 0, item.defense, true)
  if (item.maxDurability !== undefined) add(STAT_MAXDURABILITY, 0, item.maxDurability, true)
  if (item.curDurability !== undefined) add(STAT_DURABILITY, 0, item.curDurability, true)
  if (item.quantity !== undefined) add(STAT_QUANTITY, 0, item.quantity, true)
  for (const s of item.stats) add(s.statId, s.param, s.value, false)
  for (const s of item.runewordStats) add(s.statId, s.param, s.value, false)
  const stats: TransactionCostStat[] = [...acc.values()]

  // Rare/crafted affixes are sent as 3 (prefix, suffix) pairs (item-bitstream.ts).
  // In D2Common.dll (0x6fd7c53b..0x6fd7c5be), pItemData->wMagicPrefix[0..2] (+0x38..0x3c) and
  // pItemData->wMagicSuffix[0..2] (+0x3e..0x42) are always zero-initialized (0 = no affix),
  // pItemData->dwFileIndex (+0x10, read by ITEMS_GetFileIndex 0x6fd72640) is 0 for normal/body parts
  // or -1 (0xffffffff) when a set/unique ID is absent or out of range (0x6fd7ab49..0x6fd7abbc),
  // and pItemData->bEarLevel (+0x48, read by ITEMS_GetEarLevel 0x6fd736b0) is zero-initialized.
  const ra = item.rareAffixes
  const rarePrefixIds: readonly [number, number, number] =
    ra !== undefined && ra.length >= 6 ? [ra[0] ?? 0, ra[2] ?? 0, ra[4] ?? 0] : [0, 0, 0]
  const rareSuffixIds: readonly [number, number, number] =
    ra !== undefined && ra.length >= 6 ? [ra[1] ?? 0, ra[3] ?? 0, ra[5] ?? 0] : [0, 0, 0]

  let bookId = item.tomeData
  if (bookId === undefined) {
    const c = (item.code ?? '').trim().toLowerCase()
    if (c === 'tbk') bookId = 0
    else if (c === 'ibk') bookId = 1
  }

  const uniqueItemId =
    item.uniqueItemId !== undefined && item.uniqueItemId !== 0xfff ? item.uniqueItemId : -1
  const setItemId =
    item.setItemId !== undefined && item.setItemId !== 0xfff ? item.setItemId : -1

  return {
    code: item.code,
    itemFormat: item.version,
    quality,
    identified: item.identified,
    ethereal: item.ethereal,
    starterItem: item.starterItem,
    isEar: item.isEar,
    earLevel: item.earLevel ?? 0,
    bodyPartMonsterClass: item.bodyPartMonsterClass ?? 0,
    ...(bookId !== undefined ? { bookId } : {}),
    magicPrefixId: item.magicPrefixId ?? 0,
    magicSuffixId: item.magicSuffixId ?? 0,
    ...(item.autoAffixId !== undefined ? { autoAffixId: item.autoAffixId } : {}),
    uniqueItemId,
    setItemId,
    rarePrefixIds,
    rareSuffixIds,
    stats,
    socketedChildCodes: socketed.map(s => s.code),
  }
}

  /** Pricing context for `npcClass` (MonStats hcIdx) from the server-mirrored world. */
  export function transactionCostContextFromWorld(world: ClientWorld, npcClass: number): TransactionCostContext {
    let reduced = world.self.stats.get(STAT_ITEM_REDUCEDPRICES)
    let hasSlot4Or5 = false
    let hasSlot11Or12 = false
    for (const it of world.containers.equipment.values()) {
      const loc = it.bodyLoc || it.equippedSlot || 0
      if (loc === 4 || loc === 5) hasSlot4Or5 = true
      else if (loc === 11 || loc === 12) hasSlot11Or12 = true
    }
    const isSwap = world.self.weaponSet === 1 && !hasSlot4Or5 && hasSlot11Or12
    for (const it of world.containers.equipment.values()) {
      const loc = it.bodyLoc || it.equippedSlot || 0
      if (!isSwap && (loc === 11 || loc === 12)) continue
      if (isSwap && (loc === 4 || loc === 5)) continue

      for (const s of it.stats) {
        if (s.statId === STAT_ITEM_REDUCEDPRICES) reduced += s.value
      }
      if (it.runewordStats) {
        for (const s of it.runewordStats) {
          if (s.statId === STAT_ITEM_REDUCEDPRICES) reduced += s.value
        }
      }
      const socks = world.containers.sockets.get(it.id)
      if (socks) {
        for (const sock of socks) {
          for (const s of sock.stats) {
            if (s.statId === STAT_ITEM_REDUCEDPRICES) reduced += s.value
          }
        }
      }
    }

    const playerLvl =
      world.self.level > 0
        ? world.self.level
        : world.self.stats.getBase(12) > 0
          ? world.self.stats.getBase(12)
          : world.self.stats.get(12)
    const seenUniqueCharmIds = new Set<number>()
    for (const it of world.containers.inventory.values()) {
      if (it.broken || it.identified === false || (it as any).flags?.identified === false) continue
      const code = (it.code ?? '').trim().toLowerCase()
      if (code === 'cm1' || code === 'cm2' || code === 'cm3') {
        if (playerLvl > 0) {
          const reqLvl = resolveOnlineItemReqLevel(it)
          if (reqLvl > 0 && playerLvl < reqLvl) continue
        }
        const isUnique = it.quality === 7 || (it.quality as unknown) === 'unique'
        const uid = it.uniqueItemId ?? (it as any).uniqueId
        if (isUnique && typeof uid === 'number' && uid >= 0) {
          if (seenUniqueCharmIds.has(uid)) continue
          seenUniqueCharmIds.add(uid)
        }
        for (const s of it.stats) {
          if (s.statId === STAT_ITEM_REDUCEDPRICES) reduced += s.value
        }
      }
    }

    const quests = world.quests
    return {
      playerLevel: world.self.level,
      playerReducedPricesPct: reduced,
      difficulty: world.difficulty,
      npcClass,
      // 0x6fd7d0f0 tests bit `quest * 16 + state` of the quest record; S2C quest state mirrors it as 16-bit words.
      isQuestFlagSet: (questId, state) => {
        const word = quests[questId]
        if (word === undefined) throw new Error(`quest ${questId} outside the mirrored quest record`)
        return ((word >> state) & 1) === 1
      },
      tables: getCanonicalTransactionCostTables(),
    }
  }

  /** #10107 price of a server item for `type` 0 buy / 1 sell / 2 gamble / 3 repair. */
  export function priceItem113c(world: ClientWorld, item: ItemData, type: 0 | 1 | 2 | 3, npcClass: number): number {
    const socketed = world.containers.sockets.get(item.id) ?? []
    return computeTransactionCost113c(itemToTransactionCostInput(item, socketed, type), transactionCostContextFromWorld(world, npcClass), type)
  }

  /** #10071 repair-all cost over the player's equipped items (slots by body location). */
  export function repairAllCost113c(world: ClientWorld, npcClass: number): number {
    const slots: (TransactionCostInput | null)[] = new Array(REPAIR_ALL_SLOTS).fill(null)
    for (const it of world.containers.equipment.values()) {
      const loc = it.bodyLoc
      if (loc <= 0 || loc >= REPAIR_ALL_SLOTS) continue
      slots[loc] = itemToTransactionCostInput(it, world.containers.sockets.get(it.id) ?? [], 3)
    }
    return computeRepairAllCost113c(slots, transactionCostContextFromWorld(world, npcClass))
  }
