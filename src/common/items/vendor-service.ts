import { D2Rng } from '../rng/d2-rng.ts'
import type { DropTables } from './drop-tables.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'
import {
  Inventory,
  ItemFlag,
  decodeItemFlags,
  type PlacedItem,
  type Item,
} from './items.ts'
import { getInventoryGoldLimit, getStashGoldLimit } from './inventory-model.ts'
import {
  TransactionType,
  calculateGambleCost,
  calculateTransactionCost,
  isItemRepairable,
} from './item-cost.ts'
import {
  VendorNpcId,
  getTownNpcDescriptorByHcIdx,
  getTownNpcDescriptorByName,
  getTownNpcDescriptorByVendorId,
  type TownNpcServiceDescriptor,
} from '../units/npc-table.ts'
import {
  VENDOR_GRID_HEIGHT,
  VENDOR_GRID_WIDTH,
  addItemToVendorTabs,
  generateGambleInventory,
  generateVendorStoreInventory,
  resolveGambledItem,
  type VendorStoreState,
  type VendorTabKey,
} from './vendor-generator.ts'

export interface GoldPurseState {
  inventoryGold: number
  stashGold: number
  readonly cLvl: number
}

/**
 * Deducts `amount` of gold from `inventoryGold` first, then `stashGold` (1.13c vendor/repair behavior).
 * Returns `false` without mutating if total gold is insufficient.
 */
export function deductGoldFromPurse(purse: GoldPurseState, amount: number): boolean {
  const total = purse.inventoryGold + purse.stashGold
  if (amount <= 0) return true
  if (total < amount) return false

  if (purse.inventoryGold >= amount) {
    purse.inventoryGold -= amount
  } else {
    const remainder = amount - purse.inventoryGold
    purse.inventoryGold = 0
    purse.stashGold = Math.max(0, purse.stashGold - remainder)
  }
  return true
}

/**
 * Adds `amount` of gold to `inventoryGold` up to `10000 * cLvl`, overflowing any excess into `stashGold`
 * capped at `getStashGoldLimit(cLvl)` (`D2Common.dll #10439`).
 */
export function addGoldToPurse(purse: GoldPurseState, amount: number): void {
  if (amount <= 0) return
  const maxInvGold = getInventoryGoldLimit(purse.cLvl)
  const roomInInv = Math.max(0, maxInvGold - purse.inventoryGold)
  const toInv = Math.min(amount, roomInInv)
  purse.inventoryGold += toInv
  const overflow = amount - toInv
  if (overflow > 0) {
    const maxStashGold = getStashGoldLimit(purse.cLvl)
    purse.stashGold = Math.min(maxStashGold, purse.stashGold + overflow)
  }
}

export interface BuyItemResult {
  readonly ok: boolean
  readonly reason?: string | undefined
  readonly goldSpent: number
  readonly itemsGranted: readonly Item[]
  readonly countPurchased: number
}

export interface SellItemResult {
  readonly ok: boolean
  readonly reason?: string | undefined
  readonly goldEarned: number
  readonly placedInTab?: VendorTabKey | undefined
}

export interface RepairResult {
  readonly ok: boolean
  readonly reason?: string | undefined
  readonly goldSpent: number
  readonly repairedCount: number
}

export interface IdentifyAllResult {
  readonly ok: boolean
  readonly reason?: string | undefined
  readonly identifiedCount: number
  readonly goldSpent: number
}

/**
 * Stateful manager for Town NPC interactions, vendor store inventories, Gamble sessions,
 * Buy/Shift-Buy/Sell/Buyback, Repair, Heal, and Cain Identify All.
 */
export class VendorSessionManager {
  private tables: DropTables
  private readonly rng: D2Rng
  private readonly stores = new Map<string, VendorStoreState>()
  private readonly gambleStores = new Map<string, Inventory>()
  private activeDescriptor: TownNpcServiceDescriptor | null = null
  private activeTab: VendorTabKey = 'misc'
  private isGambleMode = false
  private activeGambleGrid: Inventory | null = null
  private repairCursorActive = false

  constructor(tables?: DropTables, seed = 0x1337c0de) {
    this.tables = tables ?? getEmbeddedDropTables()
    this.rng = new D2Rng(seed)
  }

  setDropTables(tables: DropTables): void {
    this.tables = tables
  }

  getTables(): DropTables {
    return this.tables
  }

  getActiveDescriptor(): TownNpcServiceDescriptor | null {
    return this.activeDescriptor
  }

  getActiveVendorId(): VendorNpcId | null {
    return this.activeDescriptor?.vendorId ?? null
  }

  getActiveTab(): VendorTabKey {
    return this.activeTab
  }

  setActiveTab(tab: VendorTabKey): void {
    this.activeTab = tab
  }

  isGambleSession(): boolean {
    return this.isGambleMode
  }

  isRepairCursorActive(): boolean {
    return this.repairCursorActive
  }

  setRepairCursorActive(active: boolean): void {
    this.repairCursorActive = active
  }

  private storeCacheKey(vendorId: VendorNpcId, difficulty: 0 | 1 | 2, cLvl: number): string {
    return `${vendorId}:${difficulty}:${cLvl}`
  }

  /**
   * Resolves a Town NPC service descriptor from `hcIdx` or display name.
   */
  resolveNpcDescriptor(
    npcNameOrHcIdx: string | number,
    actIndex?: 0 | 1 | 2 | 3 | 4,
  ): TownNpcServiceDescriptor | undefined {
    if (typeof npcNameOrHcIdx === 'number') {
      return getTownNpcDescriptorByHcIdx(npcNameOrHcIdx)
    }
    return getTownNpcDescriptorByName(npcNameOrHcIdx, actIndex)
  }

  /**
   * Gets or generates the 4-tab store state for a vendor at `(difficulty, cLvl)`.
   */
  getOrCreateVendorStore(
    vendorId: VendorNpcId,
    difficulty: 0 | 1 | 2,
    cLvl: number,
    actIndex?: 0 | 1 | 2 | 3 | 4,
  ): VendorStoreState {
    const key = this.storeCacheKey(vendorId, difficulty, cLvl)
    let store = this.stores.get(key)
    if (!store) {
      store = generateVendorStoreInventory({
        vendorId,
        difficulty,
        cLvl,
        actIndex,
        tables: this.tables,
        rng: this.rng,
      })
      this.stores.set(key, store)
    }
    return store
  }

  /**
   * Gets or generates a 10x10 Gamble inventory grid for `(vendorId, cLvl)`.
   */
  getOrCreateGambleStore(vendorId: VendorNpcId, cLvl: number): Inventory {
    const key = `gamble:${vendorId}:${cLvl}`
    let inv = this.gambleStores.get(key)
    if (!inv) {
      inv = generateGambleInventory({
        vendorId,
        cLvl,
        tables: this.tables,
        rng: this.rng,
      })
      this.gambleStores.set(key, inv)
    }
    return inv
  }

  /**
   * Convenience wrapper for UI: computes buy or gamble price for an item.
   */
  getBuyPrice(
    item: Item,
    vendorId: VendorNpcId,
    difficulty: 0 | 1 | 2,
    cLvl: number,
    isGamble = false,
  ): number {
    if (isGamble || item.isGambleMystery) {
      return calculateGambleCost({
        item,
        cLvl,
        tables: this.tables,
      })
    }
    const desc = getTownNpcDescriptorByVendorId(vendorId)
    return calculateTransactionCost({
      item,
      transactionType: TransactionType.BUY,
      difficulty,
      cLvl,
      vendorId,
      npcKey: desc?.npcTxtKey,
      actIndex: desc?.actIndex,
      tables: this.tables,
    })
  }

  /**
   * Convenience wrapper for UI: computes sell (acquisition) price for an item.
   */
  getSellPrice(
    item: Item,
    vendorId: VendorNpcId,
    difficulty: 0 | 1 | 2,
    cLvl: number,
  ): number {
    const desc = getTownNpcDescriptorByVendorId(vendorId)
    return calculateTransactionCost({
      item,
      transactionType: TransactionType.SELL,
      difficulty,
      cLvl,
      vendorId,
      npcKey: desc?.npcTxtKey,
      actIndex: desc?.actIndex,
      tables: this.tables,
    })
  }

  /**
   * Convenience wrapper for UI: computes repair price for an item.
   */
  getRepairPrice(
    item: Item,
    vendorId: VendorNpcId,
    difficulty: 0 | 1 | 2,
    cLvl: number,
  ): number {
    const desc = getTownNpcDescriptorByVendorId(vendorId)
    return calculateTransactionCost({
      item,
      transactionType: TransactionType.REPAIR,
      difficulty,
      cLvl,
      vendorId,
      npcKey: desc?.npcTxtKey,
      actIndex: desc?.actIndex,
      tables: this.tables,
    })
  }

  /**
   * Purchases and resolves a mystery item from the Gamble store at `(col, row)`.
   */
  buyGambleItem(
    vendorId: VendorNpcId,
    col: number,
    row: number,
    playerGold: number,
    cLvl: number,
  ): {
    readonly success: boolean
    readonly item?: Item | undefined
    readonly goldSpent: number
    readonly remainingGold: number
    readonly error?: string | undefined
  } {
    const gambleInv = this.getOrCreateGambleStore(vendorId, cLvl)
    const placed = gambleInv.at(col, row)
    if (!placed) {
      return { success: false, goldSpent: 0, remainingGold: playerGold, error: 'empty_cell' }
    }
    const cost = calculateGambleCost({
      item: placed.item,
      cLvl,
      tables: this.tables,
    })
    if (playerGold < cost) {
      return { success: false, goldSpent: 0, remainingGold: playerGold, error: 'not_enough_gold' }
    }
    const revealed = resolveGambledItem({
      mysteryItem: placed.item,
      cLvl,
      tables: this.tables,
      rng: this.rng,
    })
    gambleInv.remove(placed.x, placed.y)
    return {
      success: true,
      item: revealed,
      goldSpent: cost,
      remainingGold: playerGold - cost,
    }
  }

  /**
   * Opens a Trade session with a vendor NPC.
   */
  openTradeSession(
    descriptor: TownNpcServiceDescriptor,
    difficulty: 0 | 1 | 2,
    cLvl: number,
  ): VendorStoreState | null {
    if (descriptor.vendorId === null || !descriptor.canTrade) {
      return null
    }
    this.activeDescriptor = descriptor
    this.isGambleMode = false
    this.activeGambleGrid = null
    this.repairCursorActive = false

    const store = this.getOrCreateVendorStore(
      descriptor.vendorId,
      difficulty,
      cLvl,
      descriptor.actIndex,
    )

    // Choose default non-empty tab (Armor -> Weapons I -> Misc)
    if (store.tabs.armor.list().length > 0) {
      this.activeTab = 'armor'
    } else if (store.tabs.weapons1.list().length > 0) {
      this.activeTab = 'weapons1'
    } else {
      this.activeTab = 'misc'
    }
    return store
  }

  /**
   * Opens a Gamble session with a gamble-capable NPC (Gheed, Elzix, Alkor, Jamella, Anya, Nihlathak).
   */
  openGambleSession(
    descriptor: TownNpcServiceDescriptor,
    cLvl: number,
  ): Inventory | null {
    if (descriptor.vendorId === null || !descriptor.canGamble) {
      return null
    }
    this.activeDescriptor = descriptor
    this.isGambleMode = true
    this.repairCursorActive = false
    this.activeTab = 'armor'
    this.activeGambleGrid = generateGambleInventory({
      vendorId: descriptor.vendorId,
      cLvl,
      tables: this.tables,
      rng: this.rng,
    })
    return this.activeGambleGrid
  }

  /**
   * Refreshes the Gamble grid with a new roll of mystery items.
   */
  refreshGambleSession(cLvl: number): Inventory | null {
    if (!this.activeDescriptor || !this.isGambleMode || this.activeDescriptor.vendorId === null) {
      return null
    }
    this.activeGambleGrid = generateGambleInventory({
      vendorId: this.activeDescriptor.vendorId,
      cLvl,
      tables: this.tables,
      rng: this.rng,
    })
    return this.activeGambleGrid
  }

  closeSession(): void {
    this.activeDescriptor = null
    this.isGambleMode = false
    this.activeGambleGrid = null
    this.repairCursorActive = false
  }

  /**
   * Returns the currently displayed 10x10 Inventory grid for the active vendor tab or Gamble window.
   */
  getActiveTabInventory(difficulty: 0 | 1 | 2, cLvl: number): Inventory | null {
    if (!this.activeDescriptor || this.activeDescriptor.vendorId === null) {
      return null
    }
    if (this.isGambleMode) {
      if (!this.activeGambleGrid) {
        this.activeGambleGrid = generateGambleInventory({
          vendorId: this.activeDescriptor.vendorId,
          cLvl,
          tables: this.tables,
          rng: this.rng,
        })
      }
      return this.activeGambleGrid
    }
    const store = this.getOrCreateVendorStore(
      this.activeDescriptor.vendorId,
      difficulty,
      cLvl,
      this.activeDescriptor.actIndex,
    )
    return store.tabs[this.activeTab]
  }

  /**
   * Calculates the purchase price (or Gamble price) for an item in the vendor's inventory.
   */
  getItemBuyCost(options: {
    readonly item: Item
    readonly difficulty: 0 | 1 | 2
    readonly cLvl: number
    readonly vendorId?: VendorNpcId | undefined
    readonly completedQuests?: ReadonlySet<number> | undefined
    readonly reducedPricesPercent?: number | undefined
  }): number {
    const vId = options.vendorId ?? this.activeDescriptor?.vendorId ?? VendorNpcId.AKARA
    if (this.isGambleMode || options.item.isGambleMystery) {
      return calculateGambleCost({
        item: options.item,
        cLvl: options.cLvl,
        reducedPricesPercent: options.reducedPricesPercent,
        tables: this.tables,
      })
    }
    return calculateTransactionCost({
      item: options.item,
      transactionType: TransactionType.BUY,
      difficulty: options.difficulty,
      cLvl: options.cLvl,
      vendorId: vId,
      npcKey: this.activeDescriptor?.npcTxtKey,
      actIndex: this.activeDescriptor?.actIndex,
      completedQuests: options.completedQuests,
      reducedPricesPercent: options.reducedPricesPercent,
      tables: this.tables,
    })
  }

  /**
   * Calculates the acquisition (Sell to NPC) price for a player's item.
   */
  getItemSellPrice(options: {
    readonly item: Item
    readonly difficulty: 0 | 1 | 2
    readonly cLvl: number
    readonly vendorId?: VendorNpcId | undefined
    readonly completedQuests?: ReadonlySet<number> | undefined
  }): number {
    const vId = options.vendorId ?? this.activeDescriptor?.vendorId ?? VendorNpcId.AKARA
    return calculateTransactionCost({
      item: options.item,
      transactionType: TransactionType.SELL,
      difficulty: options.difficulty,
      cLvl: options.cLvl,
      vendorId: vId,
      npcKey: this.activeDescriptor?.npcTxtKey,
      actIndex: this.activeDescriptor?.actIndex,
      completedQuests: options.completedQuests,
      tables: this.tables,
    })
  }

  /**
   * Calculates the repair cost for an item.
   */
  getItemRepairCost(options: {
    readonly item: Item
    readonly difficulty: 0 | 1 | 2
    readonly cLvl: number
    readonly vendorId?: VendorNpcId | undefined
    readonly completedQuests?: ReadonlySet<number> | undefined
    readonly reducedPricesPercent?: number | undefined
  }): number {
    const vId = options.vendorId ?? this.activeDescriptor?.vendorId ?? VendorNpcId.CHARSI
    return calculateTransactionCost({
      item: options.item,
      transactionType: TransactionType.REPAIR,
      difficulty: options.difficulty,
      cLvl: options.cLvl,
      vendorId: vId,
      npcKey: this.activeDescriptor?.npcTxtKey,
      actIndex: this.activeDescriptor?.actIndex,
      completedQuests: options.completedQuests,
      reducedPricesPercent: options.reducedPricesPercent,
      tables: this.tables,
    })
  }

  /**
   * Purchases an item at `(cellX, cellY)` from the active vendor tab or Gamble grid.
   * Supports Shift-Buy (`shiftBuy: true`) for filling Tomes (`tsc`/`isc`), Belt potions (`hp*`/`mp*`), and Keys (`key`).
   */
  buyItemAtCell(options: {
    readonly cellX: number
    readonly cellY: number
    readonly shiftBuy?: boolean | undefined
    readonly purse: GoldPurseState
    readonly playerInventory: Inventory
    readonly beltItems?: (Item | null)[] | undefined
    readonly beltCapacity?: number | undefined
    readonly difficulty: 0 | 1 | 2
    readonly completedQuests?: ReadonlySet<number> | undefined
    readonly reducedPricesPercent?: number | undefined
  }): BuyItemResult {
    const {
      cellX,
      cellY,
      shiftBuy = false,
      purse,
      playerInventory,
      beltItems,
      beltCapacity,
      difficulty,
      completedQuests,
      reducedPricesPercent = 0,
    } = options

    const vendorGrid = this.getActiveTabInventory(difficulty, purse.cLvl)
    if (!vendorGrid) {
      return { ok: false, reason: 'No active vendor store', goldSpent: 0, itemsGranted: [], countPurchased: 0 }
    }

    const placement: PlacedItem | null = vendorGrid.at(cellX, cellY)
    if (!placement) {
      return { ok: false, reason: 'No item at cell', goldSpent: 0, itemsGranted: [], countPurchased: 0 }
    }

    const storeItem = placement.item
    const unitCost = this.getItemBuyCost({
      item: storeItem,
      difficulty,
      cLvl: purse.cLvl,
      completedQuests,
      reducedPricesPercent,
    })

    const totalAvailableGold = purse.inventoryGold + purse.stashGold
    if (totalAvailableGold < unitCost) {
      return { ok: false, reason: 'Not enough gold', goldSpent: 0, itemsGranted: [], countPurchased: 0 }
    }

    // Branch 1: Gamble purchase
    if (this.isGambleMode || storeItem.isGambleMystery) {
      const revealed = resolveGambledItem({
        mysteryItem: storeItem,
        cLvl: purse.cLvl,
        tables: this.tables,
        rng: this.rng,
      })
      const addedPos = playerInventory.add(revealed)
      if (!addedPos) {
        return { ok: false, reason: 'Not enough space in inventory', goldSpent: 0, itemsGranted: [], countPurchased: 0 }
      }
      deductGoldFromPurse(purse, unitCost)
      vendorGrid.remove(placement.x, placement.y)
      return {
        ok: true,
        goldSpent: unitCost,
        itemsGranted: [revealed],
        countPurchased: 1,
      }
    }

    const codeLower = storeItem.base.id.toLowerCase()

    // Branch 2: Shift-Buy Scroll (`tsc` -> `tbk`, `isc` -> `ibk`)
    if (shiftBuy && storeItem.permStore && (codeLower === 'tsc' || codeLower === 'isc')) {
      const tomeCode = codeLower === 'tsc' ? 'tbk' : 'ibk'
      const tomePlacement = playerInventory
        .list()
        .find(p => p.item.base.id.toLowerCase() === tomeCode && (p.item.quantity ?? p.item.stack) < 20)
      if (tomePlacement) {
        const curQty = tomePlacement.item.quantity ?? tomePlacement.item.stack ?? 1
        const needed = Math.max(0, 20 - curQty)
        const affordable = Math.min(needed, Math.trunc((purse.inventoryGold + purse.stashGold) / unitCost))
        if (affordable > 0) {
          const spent = affordable * unitCost
          deductGoldFromPurse(purse, spent)
          playerInventory.remove(tomePlacement.x, tomePlacement.y)
          const updatedTome: Item = {
            ...tomePlacement.item,
            stack: curQty + affordable,
            quantity: curQty + affordable,
          }
          playerInventory.place(updatedTome, tomePlacement.x, tomePlacement.y)
          return {
            ok: true,
            goldSpent: spent,
            itemsGranted: [updatedTome],
            countPurchased: affordable,
          }
        }
      }
    }

    // Branch 3: Shift-Buy Belt Potions (`autobelt`)
    if (shiftBuy && storeItem.permStore && (storeItem.base as any).autobelt && beltItems) {
      let bought = 0
      let spent = 0
      const granted: Item[] = []
      // Belt capacity = Belts.txt numboxes of the equipped belt (#913); never assume a 16-slot belt.
      if (beltCapacity === undefined) throw new Error("VendorService.buyItem: shift-buy autobelt requires beltCapacity")
      const cap = Math.min(beltCapacity, beltItems.length)
      for (let i = 0; i < cap; i++) {
        if (beltItems[i] === null) {
          if (purse.inventoryGold + purse.stashGold < unitCost) break
          deductGoldFromPurse(purse, unitCost)
          const clone: Item = {
            ...storeItem,
            permStore: false,
            uniqueId: this.rng.rand(0x7fffffff) >>> 0,
          }
          beltItems[i] = clone
          granted.push(clone)
          bought++
          spent += unitCost
        }
      }
      if (bought > 0) {
        return {
          ok: true,
          goldSpent: spent,
          itemsGranted: granted,
          countPurchased: bought,
        }
      }
    }

    // Branch 4: Shift-Buy Keys (`key` up to maxStack 12)
    if (shiftBuy && storeItem.permStore && codeLower === 'key') {
      const maxKeyStack = storeItem.base.maxStack || 12
      const existingKey = playerInventory
        .list()
        .find(p => p.item.base.id.toLowerCase() === 'key' && p.item.stack < maxKeyStack)
      if (existingKey) {
        const needed = maxKeyStack - existingKey.item.stack
        const affordable = Math.min(needed, Math.trunc((purse.inventoryGold + purse.stashGold) / unitCost))
        if (affordable > 0) {
          const spent = affordable * unitCost
          deductGoldFromPurse(purse, spent)
          playerInventory.remove(existingKey.x, existingKey.y)
          const updatedKey: Item = {
            ...existingKey.item,
            stack: existingKey.item.stack + affordable,
            quantity: existingKey.item.stack + affordable,
          }
          playerInventory.place(updatedKey, existingKey.x, existingKey.y)
          return {
            ok: true,
            goldSpent: spent,
            itemsGranted: [updatedKey],
            countPurchased: affordable,
          }
        }
      }
    }

    // Standard single-item purchase
    const purchasedItem: Item = {
      ...storeItem,
      permStore: false,
      uniqueId: storeItem.permStore ? (this.rng.rand(0x7fffffff) >>> 0) : storeItem.uniqueId,
    }

    // If buying a scroll and player has a non-full matching tome, auto-add to tome if single buy & no inventory space, or place in inventory
    const addedPos = playerInventory.add(purchasedItem)
    if (!addedPos) {
      return { ok: false, reason: 'Not enough space in inventory', goldSpent: 0, itemsGranted: [], countPurchased: 0 }
    }

    deductGoldFromPurse(purse, unitCost)
    if (!storeItem.permStore) {
      vendorGrid.remove(placement.x, placement.y)
    }

    return {
      ok: true,
      goldSpent: unitCost,
      itemsGranted: [purchasedItem],
      countPurchased: 1,
    }
  }

  /**
   * Sells an item from the player's inventory (or cursor) to the active vendor.
   * Non-permanent items are placed into the vendor's corresponding tab for Buyback!
   */
  sellPlayerItem(options: {
    readonly item: Item
    readonly purse: GoldPurseState
    readonly difficulty: 0 | 1 | 2
    readonly completedQuests?: ReadonlySet<number> | undefined
  }): SellItemResult {
    const { item, purse, difficulty, completedQuests } = options

    if ((item.base.quest ?? 0) > 0) {
      return { ok: false, reason: 'Quest items cannot be sold', goldEarned: 0 }
    }

    const sellPrice = this.getItemSellPrice({
      item,
      difficulty,
      cLvl: purse.cLvl,
      completedQuests,
    })

    addGoldToPurse(purse, sellPrice)

    let placedInTab: VendorTabKey | undefined
    if (this.activeDescriptor && this.activeDescriptor.vendorId !== null && !this.isGambleMode) {
      const store = this.getOrCreateVendorStore(
        this.activeDescriptor.vendorId,
        difficulty,
        purse.cLvl,
        this.activeDescriptor.actIndex,
      )
      // Only add to vendor tab for buyback if it's not already a permanent store consumable
      if (!item.base.permStoreItem) {
        const buybackItem: Item = {
          ...item,
          permStore: false,
        }
        let placed = addItemToVendorTabs(store.tabs, buybackItem, this.tables.itemTypes)
        if (!placed) {
          const targetTabKey: VendorTabKey =
            item.base.kind === 'armor'
              ? 'armor'
              : item.base.kind === 'weapon'
                ? 'weapons1'
                : 'misc'
          const targetGrid = store.tabs[targetTabKey]
          for (const existing of targetGrid.list()) {
            if (!existing.item.permStore) {
              targetGrid.remove(existing.x, existing.y)
              placed = addItemToVendorTabs(store.tabs, buybackItem, this.tables.itemTypes)
              if (placed) break
            }
          }
        }
        if (placed) {
          placedInTab = placed.tab
        }
      }
    }

    return {
      ok: true,
      goldEarned: sellPrice,
      ...(placedInTab ? { placedInTab } : {}),
    }
  }

  /**
   * Repairs a single item, restoring durability to `maxDurability`.
   */
  repairSingleItem(options: {
    readonly item: Item
    readonly purse: GoldPurseState
    readonly difficulty: 0 | 1 | 2
    readonly completedQuests?: ReadonlySet<number> | undefined
    readonly reducedPricesPercent?: number | undefined
  }): { readonly ok: boolean; readonly reason?: string | undefined; readonly repairedItem: Item; readonly goldSpent: number } {
    const { item, purse, difficulty, completedQuests, reducedPricesPercent = 0 } = options

    if (!isItemRepairable(item)) {
      return { ok: false, reason: 'Item cannot be repaired', repairedItem: item, goldSpent: 0 }
    }

    const cost = this.getItemRepairCost({
      item,
      difficulty,
      cLvl: purse.cLvl,
      completedQuests,
      reducedPricesPercent,
    })

    if (cost <= 0) {
      return { ok: false, reason: 'Item does not need repair', repairedItem: item, goldSpent: 0 }
    }

    if (!deductGoldFromPurse(purse, cost)) {
      return { ok: false, reason: 'Not enough gold to repair', repairedItem: item, goldSpent: 0 }
    }

    const maxDur = item.maxDurability ?? Number((item.base as any).durability) ?? 0
    const maxStack =
      (item.base as any).stackable && item.base.kind === 'weapon'
        ? item.base.maxStack || Number((item.base as any).maxstack) || item.stack
        : item.stack

    const repairedItem: Item = {
      ...item,
      ...(maxDur > 0 ? { durability: maxDur, maxDurability: maxDur } : {}),
      stack: maxStack,
      quantity: maxStack,
    }

    return { ok: true, repairedItem, goldSpent: cost }
  }

  /**
   * Repairs all damaged items across `equippedItems` and `playerInventory`.
   */
  repairAllItems(options: {
    readonly equippedItems: Map<string, Item>
    readonly playerInventory: Inventory
    readonly purse: GoldPurseState
    readonly difficulty: 0 | 1 | 2
    readonly completedQuests?: ReadonlySet<number> | undefined
    readonly reducedPricesPercent?: number | undefined
  }): RepairResult {
    const { equippedItems, playerInventory, purse, difficulty, completedQuests, reducedPricesPercent = 0 } = options

    let totalSpent = 0
    let repairedCount = 0

    // 1. Repair equipped items first
    for (const [slot, eqItem] of equippedItems.entries()) {
      if (!isItemRepairable(eqItem)) continue
      const res = this.repairSingleItem({
        item: eqItem,
        purse,
        difficulty,
        completedQuests,
        reducedPricesPercent,
      })
      if (res.ok) {
        equippedItems.set(slot, res.repairedItem)
        totalSpent += res.goldSpent
        repairedCount++
      }
    }

    // 2. Repair inventory items
    for (const placement of playerInventory.list()) {
      if (!isItemRepairable(placement.item)) continue
      const res = this.repairSingleItem({
        item: placement.item,
        purse,
        difficulty,
        completedQuests,
        reducedPricesPercent,
      })
      if (res.ok) {
        playerInventory.remove(placement.x, placement.y)
        playerInventory.place(res.repairedItem, placement.x, placement.y)
        totalSpent += res.goldSpent
        repairedCount++
      }
    }

    return {
      ok: repairedCount > 0,
      ...(repairedCount === 0 ? { reason: 'No items need repair' } : {}),
      goldSpent: totalSpent,
      repairedCount,
    }
  }

  /**
   * Calculates the total cost to repair all damaged items in `equippedItems` and `playerInventory`.
   */
  getTotalRepairAllCost(options: {
    readonly equippedItems: ReadonlyMap<string, Item>
    readonly playerInventory: Inventory
    readonly difficulty: 0 | 1 | 2
    readonly cLvl: number
    readonly completedQuests?: ReadonlySet<number> | undefined
    readonly reducedPricesPercent?: number | undefined
  }): number {
    const { equippedItems, playerInventory, difficulty, cLvl, completedQuests, reducedPricesPercent = 0 } = options
    let total = 0
    for (const eqItem of equippedItems.values()) {
      if (isItemRepairable(eqItem)) {
        total += this.getItemRepairCost({
          item: eqItem,
          difficulty,
          cLvl,
          completedQuests,
          reducedPricesPercent,
        })
      }
    }
    for (const placement of playerInventory.list()) {
      if (isItemRepairable(placement.item)) {
        total += this.getItemRepairCost({
          item: placement.item,
          difficulty,
          cLvl,
          completedQuests,
          reducedPricesPercent,
        })
      }
    }
    return total
  }

  /**
   * Deckard Cain "Identify Items" service: identifies all unidentified items in `playerInventory`.
   */
  identifyAllItems(options: {
    readonly playerInventory: Inventory
    readonly purse: GoldPurseState
    readonly cainRescued?: boolean | undefined
  }): IdentifyAllResult {
    const { playerInventory, purse, cainRescued = true } = options
    const costPerItem = cainRescued ? 0 : 100

    let identifiedCount = 0
    let goldSpent = 0

    for (const placement of playerInventory.list()) {
      const it = placement.item
      const isIdentified =
        it.flags?.identified !== false &&
        ((it.rawFlags ?? ItemFlag.IDENTIFIED) & ItemFlag.IDENTIFIED) !== 0
      if (isIdentified) continue

      if (costPerItem > 0 && !deductGoldFromPurse(purse, costPerItem)) {
        break
      }

      const newRawFlags = (it.rawFlags ?? 0) | ItemFlag.IDENTIFIED
      const identifiedItem: Item = {
        ...it,
        rawFlags: newRawFlags,
        flags: decodeItemFlags(newRawFlags),
      }
      playerInventory.remove(placement.x, placement.y)
      playerInventory.place(identifiedItem, placement.x, placement.y)
      identifiedCount++
      goldSpent += costPerItem
    }

    return {
      ok: identifiedCount > 0,
      ...(identifiedCount === 0 ? { reason: 'No unidentified items in inventory' } : {}),
      identifiedCount,
      goldSpent,
    }
  }
}
