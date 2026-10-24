/**
 * Client Item Containers (`src/client/world/inventory.ts`).
 *
 * Tracks items across all 1.13c containers (`inventory`, `equipment`, `belt`,
 * `stash`, `cube`, `cursor`, `tradeSelf`, `tradePartner`, `merc`, `shop`, `ground`,
 * and `sockets`) driven by `ServerEvent` (`ItemEvent` / `UnitRemove`).
 */

import type { ItemContainer, ItemData } from '../../netproto/index.ts'
export type { ItemContainer, ItemData } from '../../netproto/index.ts'

export interface ClientItemContainers {
  readonly inventory: ReadonlyMap<number, ItemData>
  readonly equipment: ReadonlyMap<number, ItemData>
  readonly equipmentBySlot: ReadonlyMap<number, ItemData>
  readonly remoteEquipmentByPlayerId: ReadonlyMap<number, ReadonlyMap<number, ItemData>>
  readonly belt: ReadonlyMap<number, ItemData>
  readonly beltBySlot: ReadonlyMap<number, ItemData>
  readonly stash: ReadonlyMap<number, ItemData>
  readonly cube: ReadonlyMap<number, ItemData>
  readonly cursor: ItemData | null
  readonly tradeSelf: ReadonlyMap<number, ItemData>
  readonly tradePartner: ReadonlyMap<number, ItemData>
  readonly tradeGrid: readonly ItemData[]
  readonly partnerTradeGrid: readonly ItemData[]
  readonly merc: ReadonlyMap<number, ItemData>
  readonly mercBySlot: ReadonlyMap<number, ItemData>
  readonly shop: ReadonlyMap<number, ItemData>
  readonly ground: ReadonlyMap<number, ItemData>
  readonly sockets: ReadonlyMap<number, readonly ItemData[]>
  readonly allById: ReadonlyMap<number, ItemData>
  /**
   * Bumped by every mutating entry point (applyItemEvent / remove* / clear*).
   * #941: consumers cache derived views (e.g. self equipment appearance) keyed on
   * this revision instead of re-deriving them every rendered frame.
   */
  readonly revision?: number
  /**
   * Bumped whenever any local player / HUD item container (`inventory`, `equipment`,
   * `belt`, `stash`, `cube`, `cursor`, `tradeSelf`, `tradePartner`, `merc`, `shop`,
   * `sockets`) mutates (#940 HUD container dirty-tracking & toUiItem fast cache).
   */
  readonly hudRevision?: number
  clearCursor(): ItemData | null
  clearGround(): void
  clearMerc(): void
  applyItemEvent(action: number, item: ItemData, container: ItemContainer, selfId?: number): void
  removeItemById(itemId: number): ItemData | undefined
  removeGroundItemById(itemId: number): ItemData | undefined
}

class RevisionTrackedMap<K, V> extends Map<K, V> {
  private readonly onMutate: (() => void) | undefined

  constructor(onMutate?: () => void) {
    super()
    this.onMutate = onMutate
  }

  override set(key: K, value: V): this {
    super.set(key, value)
    this.onMutate?.()
    return this
  }

  override delete(key: K): boolean {
    const deleted = super.delete(key)
    if (deleted) {
      this.onMutate?.()
    }
    return deleted
  }

  override clear(): void {
    const hadEntries = this.size > 0
    super.clear()
    if (hadEntries) {
      this.onMutate?.()
    }
  }
}

class MercContainerMap extends RevisionTrackedMap<number, ItemData> {
  private readonly bySlot: Map<number, ItemData>

  constructor(bySlot: Map<number, ItemData>, onMutate?: () => void) {
    super(onMutate)
    this.bySlot = bySlot
  }

  override get(key: number): ItemData | undefined {
    return super.get(key) ?? this.bySlot.get(key)
  }

  override has(key: number): boolean {
    return super.has(key) || this.bySlot.has(key)
  }
}

export class ClientInventoryManager implements ClientItemContainers {
  /** See ClientItemContainers.revision (#941 derived-view caching). */
  revision = 0
  /** See ClientItemContainers.hudRevision (#940 HUD container dirty-tracking). */
  hudRevision = 0
  private readonly bumpHudRevision = (): void => {
    this.revision++
    this.hudRevision++
  }
  readonly inventory = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly equipment = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly equipmentBySlot = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly remoteEquipmentByPlayerId = new Map<number, Map<number, ItemData>>()
  private readonly remoteEquipmentByItemId = new Map<number, { playerId: number; slot: number }>()
  readonly belt = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly beltBySlot = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly stash = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly cube = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  private _cursor: ItemData | null = null
  get cursor(): ItemData | null {
    return this._cursor
  }
  set cursor(val: ItemData | null) {
    if (this._cursor !== val) {
      this._cursor = val
      this.revision++
      this.hudRevision++
    }
  }
  readonly tradeSelf = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly tradePartner = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly mercBySlot = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly merc = new MercContainerMap(this.mercBySlot, this.bumpHudRevision)
  readonly shop = new RevisionTrackedMap<number, ItemData>(this.bumpHudRevision)
  readonly ground = new Map<number, ItemData>()
  readonly sockets = new RevisionTrackedMap<number, ItemData[]>(this.bumpHudRevision)
  readonly allById = new Map<number, ItemData>()

  get tradeGrid(): readonly ItemData[] {
    return [...this.tradeSelf.values()]
  }

  get partnerTradeGrid(): readonly ItemData[] {
    return [...this.tradePartner.values()]
  }

  /**
   * Clears the cursor item and removes it from `allById` / `sockets`
   * (D2Client.dll 0x6fb5db70 -> 0x6fb32f50: INVENTORY_GetCursorItem,
   * INVENTORY_SetCursorItem(pInventory, NULL), D2CLIENT_FreeUnit(pCursorItem)).
   */
  clearCursor(): ItemData | null {
    const prev = this.cursor
    if (!prev) {
      return null
    }
    this.removeItemById(prev.id)
    this.deleteSocketChildren(prev.id)
    this.cursor = null
    return prev
  }

  private deleteSocketChildren(parentId: number): void {
    const socketChildren = this.sockets.get(parentId)
    if (socketChildren) {
      for (const child of socketChildren) {
        this.allById.delete(child.id)
      }
      this.sockets.delete(parentId)
    }
  }

  /**
   * Removes an item from whichever container currently holds it.
   */
  removeItemById(itemId: number): ItemData | undefined {
    this.revision++
    const existing = this.allById.get(itemId)
    this.allById.delete(itemId)
    this.inventory.delete(itemId)
    if (this.equipment.has(itemId)) {
      const eq = this.equipment.get(itemId)!
      this.equipment.delete(itemId)
      const slot = eq.bodyLoc || eq.equippedSlot || (eq as { equipSlot?: number }).equipSlot || 0
      if (this.equipmentBySlot.get(slot)?.id === itemId) {
        this.equipmentBySlot.delete(slot)
      }
    }
    if (this.remoteEquipmentByItemId.has(itemId)) {
      const remoteLoc = this.remoteEquipmentByItemId.get(itemId)!
      this.remoteEquipmentByItemId.delete(itemId)
      const playerSlots = this.remoteEquipmentByPlayerId.get(remoteLoc.playerId)
      if (playerSlots && playerSlots.get(remoteLoc.slot)?.id === itemId) {
        playerSlots.delete(remoteLoc.slot)
        if (playerSlots.size === 0) {
          this.remoteEquipmentByPlayerId.delete(remoteLoc.playerId)
        }
      }
    }
    for (const [playerId, playerSlots] of this.remoteEquipmentByPlayerId.entries()) {
      for (const [slot, eq] of playerSlots.entries()) {
        if (eq.id === itemId) {
          playerSlots.delete(slot)
        }
      }
      if (playerSlots.size === 0) {
        this.remoteEquipmentByPlayerId.delete(playerId)
      }
    }
    if (this.belt.has(itemId)) {
      const b = this.belt.get(itemId)!
      this.belt.delete(itemId)
      const bSlot = b.gridX ?? b.x ?? 0
      if (this.beltBySlot.get(bSlot)?.id === itemId) {
        this.beltBySlot.delete(bSlot)
      }
    }
    for (const [slot, b] of this.beltBySlot.entries()) {
      if (b.id === itemId) {
        this.beltBySlot.delete(slot)
      }
    }
    this.stash.delete(itemId)
    this.cube.delete(itemId)
    if (this.cursor?.id === itemId) {
      this.cursor = null
    }
    this.tradeSelf.delete(itemId)
    this.tradePartner.delete(itemId)
    if (this.merc.has(itemId)) {
      const m = this.merc.get(itemId)
      this.merc.delete(itemId)
      if (m) {
        const slot = m.bodyLoc || m.equippedSlot || (m as { equipSlot?: number }).equipSlot || 0
        if (this.mercBySlot.get(slot)?.id === itemId) {
          this.mercBySlot.delete(slot)
        }
      }
    }
    for (const [slot, m] of this.mercBySlot.entries()) {
      if (m.id === itemId) {
        this.mercBySlot.delete(slot)
      }
    }
    this.shop.delete(itemId)
    this.ground.delete(itemId)
    for (const [parentId, children] of this.sockets.entries()) {
      const idx = children.findIndex(c => c.id === itemId)
      if (idx !== -1) {
        const next = children.filter(c => c.id !== itemId)
        this.hudRevision++
        if (next.length === 0) {
          this.sockets.delete(parentId)
        } else {
          this.sockets.set(parentId, next)
        }
      }
    }
    return existing
  }

  /**
   * Removes an item ONLY if it is currently on the ground (`this.ground`).
   * Matches D2Client.dll 0x6fb5ca40 -> 0x6fb56ef0 -> 0x6fb32550 (`DUNGEON_FindUnitInRoom`):
   * ground unit removal/pruning never removes items residing in player containers (`inventory`,
   * `equipment`, `belt`, `stash`, `cube`, `cursor`, `merc`, `tradeSelf`, `tradePartner`, `shop`).
   */
  removeGroundItemById(itemId: number): ItemData | undefined {
    this.revision++
    const existing = this.ground.get(itemId)
    if (!existing) {
      return undefined
    }
    this.ground.delete(itemId)
    this.allById.delete(itemId)
    const socketChildren = this.sockets.get(itemId)
    if (socketChildren) {
      for (const child of socketChildren) {
        this.allById.delete(child.id)
      }
      this.sockets.delete(itemId)
    }
    return existing
  }

  /**
   * Removes all tracked equipment for a remote player when that player leaves the area (`UnitRemove`).
   */
  removePlayerEquipment(playerId: number): void {
    this.revision++
    const playerSlots = this.remoteEquipmentByPlayerId.get(playerId)
    if (!playerSlots) return
    for (const eq of playerSlots.values()) {
      this.remoteEquipmentByItemId.delete(eq.id)
      this.allById.delete(eq.id)
      this.sockets.delete(eq.id)
    }
    this.remoteEquipmentByPlayerId.delete(playerId)
  }

  /**
   * Applies an `ItemEvent` from `0x9C` (`WorldItemAction`) or `0x9D` (`OwnedItemAction`).
   */
  applyItemEvent(action: number, item: ItemData, container: ItemContainer, selfId?: number): void {
    this.revision++
    const isRemotePlayerOwner =
      item.ownerType === 0 &&
      item.ownerId !== undefined &&
      item.ownerId !== 0 &&
      selfId !== undefined &&
      selfId !== 0 &&
      item.ownerId !== selfId

    const numericFlags =
      typeof item.rawFlags === 'number'
        ? item.rawFlags
        : typeof item.flags === 'number'
          ? item.flags
          : 0
    const isDeleted =
      (numericFlags & 0x20) !== 0 ||
      Boolean(
        typeof item.flags === 'object' &&
          item.flags !== null &&
          (item.flags as { deleted?: boolean }).deleted,
      )

    // 0x05 RemoveFromContainer (D2Client.dll 0x6fb344f0):
    // At 0x6fb3462a, D2Client checks ITEMS_CheckItemFlag(pItem, 0x20) (IFLAG_DELETED).
    // The item goes to the cursor only when IFLAG_DELETED (0x20) is clear, the packet's
    // location is the cursor (pickup), AND the item was not already on the cursor.
    // Selling to an NPC sends act 0x05 with location 0 (capture 06-d2gs-vendor-buy-sell:
    // 0x22 -> 0x9D act 5 loc 0 -> 0x2A result 1 flag 3), or when selling from cursor
    // (location 4 / container 'cursor' while this.cursor?.id === item.id), the item
    // leaves the player's containers / cursor.
    if (
      action === 0x05 &&
      (isDeleted || container !== 'cursor' || this.cursor?.id === item.id || this.tradePartner.has(item.id))
    ) {
      this.removeItemById(item.id)
      this.deleteSocketChildren(item.id)
      return
    }
    // 0x08 Unequip (D2Client.dll 0x6fb35ed0) & 0x09 SwapBodyItem IFLAG_SWITCHOUT (D2Client.dll 0x6fb369e0 -> 0x6fb34300):
    // At 0x6fb36031 / 0x6fb3446d, D2Client checks ITEMS_CheckItemFlag(pItem, 0x20) (IFLAG_DELETED).
    // When a dead player presses ESC (0x41 Resurrect), D2Game.dll (PLAYER_CreateCorpse
    // 0x6fc99250 -> 0x6fc9951c -> 0x6fc98d00 @ 0x6fc98d88) sets IFLAG_DELETED (0x20) and
    // IEVENT_UNEQUIP (0x10) on each equipped item of the player (ownerId = selfId, location = 1)
    // and clones the item onto the corpse unit (0x6fc307e0 -> 0x9D action 0x06).
    // When IFLAG_DELETED (0x20) is set (or when owner is a remote player/corpse at 0x6fb35fee),
    // D2Client removes the item from the owner's equipment and deletes it without calling
    // INVENTORY_SetCursorItem (0x6fabc7d8).
    const isSwapBodySwitchOut =
      action === 0x09 &&
      (((numericFlags & 0x80) !== 0 && (numericFlags & 0x40) === 0) ||
        container === 'cursor' ||
        item.location === 4)
    if ((action === 0x08 || isSwapBodySwitchOut || action === 0x16) && (isDeleted || isRemotePlayerOwner)) {
      if (isRemotePlayerOwner) {
        const remoteLoc = this.remoteEquipmentByItemId.get(item.id)
        if (remoteLoc && (!item.ownerId || remoteLoc.playerId === item.ownerId)) {
          this.remoteEquipmentByItemId.delete(item.id)
          const playerSlots = this.remoteEquipmentByPlayerId.get(remoteLoc.playerId)
          if (playerSlots && playerSlots.get(remoteLoc.slot)?.id === item.id) {
            playerSlots.delete(remoteLoc.slot)
            if (playerSlots.size === 0) {
              this.remoteEquipmentByPlayerId.delete(remoteLoc.playerId)
            }
          }
        }
        if (item.ownerId) {
          const playerSlots = this.remoteEquipmentByPlayerId.get(item.ownerId)
          if (playerSlots) {
            const slot = item.bodyLoc || item.equippedSlot || (item as { equipSlot?: number }).equipSlot || 0
            if (slot > 0 && (!playerSlots.has(slot) || playerSlots.get(slot)?.id === item.id)) {
              playerSlots.delete(slot)
            }
            for (const [s, eq] of playerSlots.entries()) {
              if (eq.id === item.id) {
                playerSlots.delete(s)
              }
            }
            if (playerSlots.size === 0) {
              this.remoteEquipmentByPlayerId.delete(item.ownerId)
            }
          }
        }
        if (!this.equipment.has(item.id)) {
          this.allById.delete(item.id)
          const socketChildren = this.sockets.get(item.id)
          if (socketChildren) {
            for (const child of socketChildren) {
              this.allById.delete(child.id)
            }
            this.sockets.delete(item.id)
          }
        }
        return
      }
      const remoteLoc = this.remoteEquipmentByItemId.get(item.id)
      if (
        remoteLoc &&
        item.ownerId !== undefined &&
        item.ownerId !== 0 &&
        remoteLoc.playerId !== item.ownerId
      ) {
        if (this.equipment.has(item.id)) {
          const eq = this.equipment.get(item.id)!
          this.equipment.delete(item.id)
          const slot = eq.bodyLoc || eq.equippedSlot || (eq as { equipSlot?: number }).equipSlot || 0
          if (this.equipmentBySlot.get(slot)?.id === item.id) {
            this.equipmentBySlot.delete(slot)
          }
        }
        const slot = item.bodyLoc || item.equippedSlot || (item as { equipSlot?: number }).equipSlot || 0
        if (slot > 0 && this.equipmentBySlot.get(slot)?.id === item.id) {
          this.equipmentBySlot.delete(slot)
        }
        if (this.cursor?.id === item.id) {
          this.cursor = null
        }
        return
      }
      this.removeItemById(item.id)
      this.deleteSocketChildren(item.id)
      return
    }
    // 0x0F RemoveFromBelt (D2Client.dll 0x6fb32c60):
    // At 0x6fb32d8b, D2Client checks ITEMS_CheckItemFlag(pItem, 0x20) (IFLAG_DELETED).
    // When a belt potion is consumed via 0x26 BeltUse (IFLAG_DELETED 0x20 set, or packet
    // container is 'belt' / location 2 rather than 'cursor' / location 4), 0x6fb32dce
    // removes the item from the belt and deletes it without placing it on the cursor.
    if (action === 0x0f && (isDeleted || (container !== 'cursor' && item.location !== 4))) {
      this.removeItemById(item.id)
      this.deleteSocketChildren(item.id)
      return
    }
    // Removal-to-cursor and login-cursor actions:
    // 0x01 GroundToCursor, 0x02 ToCursor (when container is cursor or location === 4), 0x05 RemoveFromContainer (to cursor),
    // 0x08 Unequip (to cursor when IFLAG_DELETED is clear), 0x09 SwapBodyItem (when IFLAG_SWITCHOUT 0x80 is set or location === 4 per D2Client.dll 0x6fb369e0 -> 0x6fb34300),
    // 0x0F RemoveFromBelt (to cursor when picked up via 0x24 BeltRemove without IFLAG_DELETED),
    // 0x12 ToCursor (ITEMACTION_TOCURSOR = 18 on login/rejoin per D2Game.dll 0x6fc3efa0 / InvMode.cpp:172),
    // 0x16 (D2Client.dll 0x6fb33790 -> INVENTORY_SetCursorItem 0x6fb33830)
    if (
      action === 0x01 ||
      (action === 0x02 && (container === 'cursor' || item.location === 4)) ||
      action === 0x05 ||
      action === 0x08 ||
      isSwapBodySwitchOut ||
      action === 0x12 ||
      action === 0x16 ||
      (action === 0x0f && (container === 'cursor' || item.location === 4)) ||
      ((action === 0x00 || action === 0x04) && (container === 'cursor' || item.location === 4))
    ) {
      this.removeItemById(item.id)
      if (!isRemotePlayerOwner) {
        const cursorItem: ItemData = {
          ...item,
          container: 'cursor',
          ...(action === 0x08 || isSwapBodySwitchOut || action === 0x16
            ? { location: 4, bodyLoc: 0, equippedSlot: 0 }
            : {}),
        }
        this.cursor = cursorItem
        this.allById.set(item.id, cursorItem)
      }
      return
    }

    // 0x0C RemoveFromShop
    if (action === 0x0c) {
      this.removeItemById(item.id)
      this.deleteSocketChildren(item.id)
      return
    }

    let effectiveContainer = container
    if (item.ownerType === 1 && (effectiveContainer === 'equipment' || action === 0x06 || action === 0x07 || action === 0x09)) {
      effectiveContainer = 'merc'
    } else if (effectiveContainer === 'trade') {
      // Per D2Common.dll 0x6fd7c158 and D2Game.dll 0x6fc91b00:
      // - storePage === 2 (bInvPage = 1) is the partner's trade offer grid (sent via S2C 0x9C action=0x04 with no ownerId header).
      // - storePage === 3 (bInvPage = 2) is the local player's self trade offer grid.
      // Also support explicit remote ownerId on S2C 0x9D packets.
      if (
        (item.ownerId !== undefined && selfId !== undefined && item.ownerId !== selfId) ||
        (item.storePage === 2 && (item.ownerId === undefined || item.ownerId === 0 || item.ownerId === selfId))
      ) {
        effectiveContainer = 'tradePartner'
      } else {
        effectiveContainer = 'tradeSelf'
      }
    }

    const isRemotePlayerPrivate =
      isRemotePlayerOwner &&
      effectiveContainer !== 'tradePartner' &&
      effectiveContainer !== 'socket' &&
      effectiveContainer !== 'ground'

    let prevItem: ItemData | undefined
    if (isRemotePlayerPrivate) {
      if (this.remoteEquipmentByItemId.has(item.id)) {
        const remoteLoc = this.remoteEquipmentByItemId.get(item.id)!
        this.remoteEquipmentByItemId.delete(item.id)
        const playerSlots = this.remoteEquipmentByPlayerId.get(remoteLoc.playerId)
        if (playerSlots && playerSlots.get(remoteLoc.slot)?.id === item.id) {
          prevItem = playerSlots.get(remoteLoc.slot)
          playerSlots.delete(remoteLoc.slot)
          if (playerSlots.size === 0) {
            this.remoteEquipmentByPlayerId.delete(remoteLoc.playerId)
          }
        }
      }
      if (item.ownerId) {
        const playerSlots = this.remoteEquipmentByPlayerId.get(item.ownerId)
        if (playerSlots) {
          for (const [s, eq] of playerSlots.entries()) {
            if (eq.id === item.id) {
              prevItem ??= eq
              playerSlots.delete(s)
            }
          }
          if (playerSlots.size === 0) {
            this.remoteEquipmentByPlayerId.delete(item.ownerId)
          }
        }
      }
      if (!this.equipment.has(item.id) && !this.inventory.has(item.id)) {
        prevItem ??= this.allById.get(item.id)
        this.allById.delete(item.id)
      }
    } else {
      // Remove previous placement of this item ID before placing into target container
      prevItem = this.removeItemById(item.id)
    }

    const rawIdentified =
      item.identified !== undefined
        ? Boolean(item.identified)
        : ((item.rawFlags ?? 0) & 0x10) !== 0
    const wasGambleShopItem =
      effectiveContainer !== 'shop' &&
      Boolean(
        prevItem?.container === 'shop' ||
          (prevItem as any)?.isGambleMystery === true ||
          (item as any).isGambleMystery === true ||
          (item as any).flags?.gamble === true,
      )
    const isIdentified = wasGambleShopItem ? true : rawIdentified
    const stored: ItemData = {
      ...item,
      container: effectiveContainer,
      identified: isIdentified,
      ...(effectiveContainer === 'shop' && !isIdentified
        ? { isGambleMystery: true }
        : wasGambleShopItem || isIdentified
          ? { isGambleMystery: false }
          : {}),
      ...(isIdentified
        ? {
            flags: typeof item.flags === 'number' ? ((item.flags | 0x10) >>> 0) : (item.flags as any),
            rawFlags: (((item.rawFlags ?? 0) | 0x10) >>> 0),
          }
        : {
            flags: typeof item.flags === 'number' ? ((item.flags & ~0x10) >>> 0) : (item.flags as any),
            rawFlags: (((item.rawFlags ?? 0) & ~0x10) >>> 0),
          }),
    }
    if (!isRemotePlayerPrivate || (!this.equipment.has(stored.id) && !this.inventory.has(stored.id))) {
      this.allById.set(stored.id, stored)
    }

    if (isRemotePlayerPrivate) {
      if (effectiveContainer === 'equipment') {
        const slot = stored.bodyLoc || stored.equippedSlot || (stored as { equipSlot?: number }).equipSlot || 0
        if (slot > 0) {
          let playerSlots = this.remoteEquipmentByPlayerId.get(stored.ownerId!)
          if (!playerSlots) {
            playerSlots = new Map<number, ItemData>()
            this.remoteEquipmentByPlayerId.set(stored.ownerId!, playerSlots)
          }
          // 0x07 IndirectlySwapBodyItem (D2Client.dll 0x6fb361a0, jump table 0x6fb36518: 4<->5, 11<->12):
          // Removes the incompatible item in the opposite hand slot before equipping `stored` into `slot`.
          if (action === 0x07) {
            const oppositeSlot =
              slot === 4 ? 5 : slot === 5 ? 4 : slot === 11 ? 12 : slot === 12 ? 11 : 0
            if (oppositeSlot > 0) {
              const oppItem = playerSlots.get(oppositeSlot)
              if (oppItem && oppItem.id !== stored.id) {
                playerSlots.delete(oppositeSlot)
                this.remoteEquipmentByItemId.delete(oppItem.id)
                this.allById.delete(oppItem.id)
                const socketChildren = this.sockets.get(oppItem.id)
                if (socketChildren) {
                  for (const child of socketChildren) {
                    this.allById.delete(child.id)
                  }
                  this.sockets.delete(oppItem.id)
                }
              }
            }
          }
          const prevInSlot = playerSlots.get(slot)
          if (prevInSlot && prevInSlot.id !== stored.id) {
            const counterpartSlot =
              action === 0x17
                ? slot === 4
                  ? 11
                  : slot === 11
                    ? 4
                    : slot === 5
                      ? 12
                      : slot === 12
                        ? 5
                        : 0
                : 0
            if (counterpartSlot > 0 && !playerSlots.has(counterpartSlot)) {
              const displaced: ItemData = {
                ...prevInSlot,
                bodyLoc: counterpartSlot,
                equippedSlot: counterpartSlot,
              }
              playerSlots.set(counterpartSlot, displaced)
              this.remoteEquipmentByItemId.set(displaced.id, {
                playerId: stored.ownerId!,
                slot: counterpartSlot,
              })
              this.allById.set(displaced.id, displaced)
            } else {
              this.remoteEquipmentByItemId.delete(prevInSlot.id)
              this.allById.delete(prevInSlot.id)
              const socketChildren = this.sockets.get(prevInSlot.id)
              if (socketChildren) {
                for (const child of socketChildren) {
                  this.allById.delete(child.id)
                }
                this.sockets.delete(prevInSlot.id)
              }
            }
          }
          playerSlots.set(slot, stored)
          this.remoteEquipmentByItemId.set(stored.id, { playerId: stored.ownerId!, slot })
        }
      }
      return
    }

    switch (effectiveContainer) {
      case 'ground':
        this.ground.set(stored.id, stored)
        break
      case 'cursor':
        this.cursor = stored
        break
      case 'inventory':
        this.inventory.set(stored.id, stored)
        break
      case 'stash':
        this.stash.set(stored.id, stored)
        break
      case 'cube':
        this.cube.set(stored.id, stored)
        break
      case 'equipment': {
        const slot = stored.bodyLoc || stored.equippedSlot || (stored as { equipSlot?: number }).equipSlot || 0
        if (slot > 0) {
          // 0x07 IndirectlySwapBodyItem (D2Client.dll 0x6fb361a0, jump table 0x6fb36518: 4<->5, 11<->12):
          // Sent by D2Game.dll sInsertItemBodyRmvOpp (0x6fc93860) in response to C2S 0x1B (Swap2HandedItem).
          // D2GS sends a single 0x9D action=0x07 packet carrying the newly equipped item in `slot`;
          // D2Client removes the incompatible item in `oppositeSlot` (4<->5, 11<->12) and places it onto
          // the local player's cursor (INVENTORY_SetCursorItem at 0x6fb3635d, mode=4).
          if (action === 0x07) {
            const oppositeSlot =
              slot === 4 ? 5 : slot === 5 ? 4 : slot === 11 ? 12 : slot === 12 ? 11 : 0
            if (oppositeSlot > 0) {
              const oppItem = this.equipmentBySlot.get(oppositeSlot)
              if (oppItem && oppItem.id !== stored.id) {
                this.equipmentBySlot.delete(oppositeSlot)
                this.equipment.delete(oppItem.id)
                const cursorOppItem: ItemData = {
                  ...oppItem,
                  container: 'cursor',
                  location: 4,
                  bodyLoc: 0,
                  equippedSlot: 0,
                }
                this.cursor = cursorOppItem
                this.allById.set(oppItem.id, cursorOppItem)
              }
            }
          }
          const prevInSlot = this.equipmentBySlot.get(slot)
          if (prevInSlot && prevInSlot.id !== stored.id) {
            const counterpartSlot =
              action === 0x17
                ? slot === 4
                  ? 11
                  : slot === 11
                    ? 4
                    : slot === 5
                      ? 12
                      : slot === 12
                        ? 5
                        : 0
                : 0
            if (counterpartSlot > 0 && !this.equipmentBySlot.has(counterpartSlot)) {
              const displaced: ItemData = {
                ...prevInSlot,
                bodyLoc: counterpartSlot,
                equippedSlot: counterpartSlot,
              }
              this.equipmentBySlot.set(counterpartSlot, displaced)
              this.equipment.set(displaced.id, displaced)
              this.allById.set(displaced.id, displaced)
            } else if (action === 0x09 && !this.cursor) {
              this.equipment.delete(prevInSlot.id)
              const cursorPrevItem: ItemData = {
                ...prevInSlot,
                container: 'cursor',
                location: 4,
                bodyLoc: 0,
                equippedSlot: 0,
              }
              this.cursor = cursorPrevItem
              this.allById.set(prevInSlot.id, cursorPrevItem)
            } else {
              this.equipment.delete(prevInSlot.id)
              this.allById.delete(prevInSlot.id)
            }
          }
          this.equipmentBySlot.set(slot, stored)
        }
        this.equipment.set(stored.id, stored)
        break
      }
      case 'belt': {
        const bSlot = stored.gridX ?? stored.x ?? 0
        const prevInSlot = this.beltBySlot.get(bSlot)
        if (prevInSlot && prevInSlot.id !== stored.id) {
          this.belt.delete(prevInSlot.id)
          this.allById.delete(prevInSlot.id)
        }
        this.belt.set(stored.id, stored)
        this.beltBySlot.set(bSlot, stored)
        break
      }
      case 'merc': {
        const mSlot = stored.bodyLoc || stored.equippedSlot || (stored as { equipSlot?: number }).equipSlot || 0
        if (mSlot > 0) {
          if (action === 0x07) {
            const oppositeSlot =
              mSlot === 4 ? 5 : mSlot === 5 ? 4 : mSlot === 11 ? 12 : mSlot === 12 ? 11 : 0
            if (oppositeSlot > 0) {
              const oppItem = this.mercBySlot.get(oppositeSlot)
              if (oppItem && oppItem.id !== stored.id) {
                this.mercBySlot.delete(oppositeSlot)
                this.merc.delete(oppItem.id)
                const cursorOppItem: ItemData = {
                  ...oppItem,
                  container: 'cursor',
                  location: 4,
                  bodyLoc: 0,
                  equippedSlot: 0,
                }
                this.cursor = cursorOppItem
                this.allById.set(oppItem.id, cursorOppItem)
              }
            }
          }
          const prevInSlot = this.mercBySlot.get(mSlot)
          if (prevInSlot && prevInSlot.id !== stored.id) {
            if (action === 0x09 && !this.cursor) {
              this.merc.delete(prevInSlot.id)
              const cursorPrevItem: ItemData = {
                ...prevInSlot,
                container: 'cursor',
                location: 4,
                bodyLoc: 0,
                equippedSlot: 0,
              }
              this.cursor = cursorPrevItem
              this.allById.set(prevInSlot.id, cursorPrevItem)
            } else {
              this.merc.delete(prevInSlot.id)
              this.allById.delete(prevInSlot.id)
            }
          }
          this.mercBySlot.set(mSlot, stored)
        }
        this.merc.set(stored.id, stored)
        break
      }
      case 'shop':
        this.shop.set(stored.id, stored)
        break
      case 'tradeSelf':
        this.tradeSelf.set(stored.id, stored)
        break
      case 'tradePartner':
        this.tradePartner.set(stored.id, stored)
        break
      case 'socket': {
        const parentId = stored.ownerId ?? 0
        const prev = this.sockets.get(parentId) ?? []
        this.sockets.set(parentId, [...prev.filter(x => x.id !== stored.id), stored])
        this.hudRevision++
        break
      }
      default:
        this.inventory.set(stored.id, stored)
        break
    }
  }

  /**
   * Drops every store unit. The server sends no RemoveFromShop after C2S 0x30
   * (capture 05-d2gs-vendor-open), so the client frees the store locally.
   */
  clearShop(): void {
    this.revision++
    for (const id of this.shop.keys()) {
      this.allById.delete(id)
      this.sockets.delete(id)
    }
    this.shop.clear()
  }

  /**
   * Drops every ground item unit when switching acts or unloading rooms.
   */
  clearGround(): void {
    this.revision++
    for (const id of this.ground.keys()) {
      this.allById.delete(id)
      this.sockets.delete(id)
    }
    this.ground.clear()
  }

  /**
   * Clears all equipped mercenary items (`merc` and `mercBySlot`) and their
   * associated `allById` and `sockets` entries when replacing a mercenary
   * (`C2S 0x36 MercHire` / `S2C 0x81 AssignMerc`, Issue #994).
   */
  clearMerc(): void {
    const idsToDelete = new Set<number>()
    for (const id of this.merc.keys()) {
      idsToDelete.add(id)
    }
    for (const item of this.mercBySlot.values()) {
      idsToDelete.add(item.id)
    }
    if (idsToDelete.size === 0 && this.merc.size === 0 && this.mercBySlot.size === 0) {
      return
    }
    this.revision++
    this.hudRevision++
    for (const id of idsToDelete) {
      this.allById.delete(id)
      const socketChildren = this.sockets.get(id)
      if (socketChildren) {
        for (const child of socketChildren) {
          this.allById.delete(child.id)
        }
        this.sockets.delete(id)
      }
    }
    this.merc.clear()
    this.mercBySlot.clear()
  }

  /**
   * Clears both trade grids (`tradeSelf` and `tradePartner`) on `0x77` cancel/done or `0x92` ClearDisplay.
   */
  clearTrade(): void {
    this.revision++
    for (const id of this.tradeSelf.keys()) {
      this.allById.delete(id)
      this.deleteSocketChildren(id)
    }
    for (const id of this.tradePartner.keys()) {
      this.allById.delete(id)
      this.deleteSocketChildren(id)
    }
    this.tradeSelf.clear()
    this.tradePartner.clear()
  }

  clear(): void {
    this.revision++
    this.inventory.clear()
    this.equipment.clear()
    this.equipmentBySlot.clear()
    this.remoteEquipmentByPlayerId.clear()
    this.remoteEquipmentByItemId.clear()
    this.belt.clear()
    this.beltBySlot.clear()
    this.stash.clear()
    this.cube.clear()
    this.cursor = null
    this.tradeSelf.clear()
    this.tradePartner.clear()
    this.merc.clear()
    this.mercBySlot.clear()
    this.shop.clear()
    this.ground.clear()
    this.sockets.clear()
    this.allById.clear()
  }
}
