/**
 * GameInstance Subsystem: Player Inventory, Equipment, Merc Gear, Belt Potions, Stacking & Quest Scrolls (`src/server/engine/game-instance/player-inventory.ts`).
 */

import { BELT_CODE_TO_ROWS, BELT_POTION_CATALOG, NO_BELT_ROWS } from '../../../common/items/belt-model.ts'
import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_CUSTOM_5_113C, QUEST_FLAG_CUSTOM_6_113C, QUEST_FLAG_CUSTOM_7_113C, QUEST_FLAG_CUSTOM_8_113C, QUEST_FLAG_REWARD_PENDING_113C, QUEST_FLAG_STARTED_113C, clearQuestFlag113c, hasQuestFlag113c, setQuestFlag113c } from '../quests-113c.ts'
import { resolveHirelingStatsAtLevel } from '../../../common/units/hireling-table.ts'
import type { ServerEvent, UnitId } from '../../../netproto/index.ts'
import { canUnitEquipItem113c, computeItemRequirements113c } from '../../../common/items/equip-req-113c.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { getInventoryGoldLimit } from '../../../common/items/inventory-model.ts'
import { TRADE_GRID_HEIGHT_113C, TRADE_GRID_WIDTH_113C } from '../../net/trade-manager-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalPlayerRecord, ServerItemEntry } from './types.ts'
import { ITEM_PICKUP_MAX_DISTANCE_SUBTILES, lookupBaseInfo, playerWirePosition, toItemContainer, UNIT_TYPE_113C } from './constants-and-helpers.ts'


function handleItemPickup(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  toCursor: boolean,
  allowRanged = false,
): void {
  const gItem = this.groundItems.get(itemId)
  if (!gItem || gItem.areaId !== player.areaId) return
  if (
    !allowRanged &&
    Math.hypot(player.x - gItem.x, player.y - gItem.y) > ITEM_PICKUP_MAX_DISTANCE_SUBTILES
  ) {
    return
  }

  if (gItem.code === 'gld') {
    // 1.13c D2Game.dll @ 0x6FCF6C80 (`ITEMS_PickUpGold`):
    // splits picked-up gold equally across alive allied party members in the same `areaId`
    // (`PartyManager.splitGold`, remainder to picker), caps each recipient's STAT_GOLD (14) at
    // `D2Common_GetInventoryGoldLimit(pPlayer)` (`clvl * 10000`, 0x6FD81940 / ordinal #10049),
    // removes the ground pile, and drops any unabsorbable overflow back onto the ground (#1860).
    const itemGold = Math.max(0, Math.trunc(gItem.quantity))
    const goldCandidates: {
      readonly unitId: number
      readonly areaId: number
      readonly level: number
      readonly currentGold: number
      readonly maxGold: number
      readonly dead: boolean
    }[] = []
    for (const p of this.players.values()) {
      this.partyManager.updatePlayer(p.unitId, {
        level: p.level,
        areaId: p.areaId,
      })
      goldCandidates.push({
        unitId: p.unitId,
        areaId: p.areaId,
        level: p.level,
        currentGold: p.gold,
        maxGold: getInventoryGoldLimit(p.level),
        dead: p.dead,
      })
    }
    const { shares, overflowGold } = this.partyManager.splitGold(
      player.unitId,
      itemGold,
      goldCandidates,
    )
    this.groundItems.delete(itemId)
    this.broadcastToArea(player.areaId, {
      type: 'UnitRemove',
      unitType: 4,
      id: itemId,
      unitId: itemId,
    })
    for (const [recipientId, gained] of shares.entries()) {
      if (gained <= 0) continue
      const recipient = this.players.get(recipientId)
      if (!recipient) continue
      recipient.gold += gained
      this.emitPlayerGoldStat(recipient)
    }
    if (overflowGold > 0) {
      this.dropPlayerGoldPile(player, overflowGold)
    }
    return
  }

  // 1.13c D2Game.dll @ 0x6fcf7020 -> 0x6fcf2f00 (`ITEMS_CheckQuestItemPickup`, #2002):
  // reject completed-quest items and symmetric conflicting quest items BEFORE removing the item
  // from the ground, and emit S2C 0x2C sound 19 (`impossible1`).
  if (!this.canPickupQuestItem113c(player, gItem)) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return
  }

  // 1.13c `UniqueItems.txt` `carry1 = 1` (`D2Game.dll` `0x6FCF2F00`, `#357` Gheed's Fortune,
  // `#381` Annihilus, `#400` Hellfire Torch): reject duplicate pickup before removing from ground.
  const carry1UniqueId = this.resolveCarry1UniqueId113c(gItem)
  if (
    carry1UniqueId !== undefined &&
    player.items.some((owned) => this.resolveCarry1UniqueId113c(owned) === carry1UniqueId)
  ) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return
  }

  // 1.13c D2Game.dll @ 0x6fcf71c2: when picking up to cursor (`toCursor = 1`),
  // if the player's cursor already holds an item, reject before removing from ground.
  if (toCursor && player.items.some((i) => i.location === 'cursor')) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return
  }

  const isKey = !toCursor && gItem.code.trim().toLowerCase() === 'key'
  let stackableKeyCap = 0
  if (isKey) {
    for (const existing of player.items) {
      if (
        existing.location === 'inventory' &&
        existing.code.trim().toLowerCase() === 'key' &&
        (existing.quantity || 1) < 12
      ) {
        stackableKeyCap += 12 - Math.max(1, existing.quantity || 1)
      }
    }
  }
  const initialQty = Math.max(1, gItem.quantity || 1)
  const needsInventorySlot = !toCursor && (!isKey || initialQty > stackableKeyCap)
  const slot = needsInventorySlot
    ? this.findFreeGridSlot(player, 'inventory', gItem.width, gItem.height, 10, 4)
    : undefined

  // 1.13c D2Game.dll @ 0x6fcf711f..0x6fcf7145: when picking up to inventory (`toCursor = 0`)
  // and there is no room in the inventory grid (and keys cannot fully stack),
  // play sound 23 (`cantCarry1`) and leave the item on the ground.
  if (!toCursor && needsInventorySlot && !slot && (!isKey || stackableKeyCap <= 0)) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 23,
    })
    return
  }

  this.broadcastToArea(player.areaId, {
    type: 'UnitRemove',
    unitType: 4,
    id: itemId,
    unitId: itemId,
    areaId: player.areaId,
  })
  this.groundItems.delete(itemId)
  gItem.expireFrame = undefined

  gItem.ownerId = player.unitId
  if (isKey) {
    let remQty = initialQty
    for (const existing of player.items) {
      if (
        existing.location === 'inventory' &&
        existing.code.trim().toLowerCase() === 'key' &&
        (existing.quantity || 1) < 12
      ) {
        const curQty = Math.max(1, existing.quantity || 1)
        const addQty = Math.min(12 - curQty, remQty)
        existing.quantity = curQty + addQty
        if (existing.rawItemData !== undefined) {
          existing.rawItemData = { ...existing.rawItemData, quantity: existing.quantity }
        }
        remQty -= addQty
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'update',
          itemId: existing.unitId,
          code: existing.code,
          x: existing.x,
          y: existing.y,
          container: 'inventory',
          item: this.serverEntryToItemData(existing),
        })
        if (remQty <= 0) {
          return
        }
      }
    }
    gItem.quantity = remQty
    if (!slot) {
      // Partial key stack filled existing key stacks; drop remaining keys back onto ground.
      gItem.ownerId = 0
      gItem.location = 'ground'
      this.registerGroundItem113c(gItem)
      this.broadcastToArea(player.areaId, {
        type: 'ItemEvent',
        action: 'drop',
        itemId: gItem.unitId,
        code: gItem.code,
        x: gItem.x,
        y: gItem.y,
        container: 'ground',
        item: { ...this.serverEntryToItemData(gItem), action: 0x02 },
      })
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 23,
      })
      return
    }
  }

  if (toCursor) {
    this.placeServerItem113c(gItem, 'cursor', 0, 0, player.unitId)
  } else {
    this.placeServerItem113c(gItem, 'inventory', slot!.x, slot!.y, player.unitId)
  }
  player.items.push(gItem)
  if (!toCursor) {
    this.refreshPlayerAccruedMaxPools(player)
  }

  const pickedContainer = toCursor ? 'cursor' : 'inventory'
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'pickup',
    itemId: gItem.unitId,
    code: gItem.code,
    x: gItem.x,
    y: gItem.y,
    container: pickedContainer,
    item: this.serverEntryToItemData(gItem),
  })
  this.emitSocketChildrenToPlayer(player.unitId, gItem, 0x13)

  // D2Game.dll @ 0x6fd07640 (ACT3Q1_Callback03_ItemPickedUp) & 0x6fd09060 (ACT3Q4 Lam Esen's Tome):
  const pickedCode = gItem.code.toLowerCase().trim()
  if (
    pickedCode === 'bbb' &&
    !hasQuestFlag113c(player.questFlags, 'a3q4', QUEST_FLAG_COMPLETED_113C)
  ) {
    this.setPlayerQuestFlag(
      player,
      'a3q4',
      QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C,
    )
  }
  if (
    (pickedCode === 'j34' || pickedCode === 'g34') &&
    !hasQuestFlag113c(
      player.questFlags,
      'a3q1',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
    )
  ) {
    if (
      pickedCode === 'j34' &&
      !hasQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_CUSTOM_6_113C)
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 72,
      })
      this.setPlayerQuestFlag(player, 'a3q1', QUEST_FLAG_CUSTOM_6_113C)
    } else {
      this.emitQuestFlagSync113c(player, 'a3q1')
    }
  }
}



function findPlayerItemIndex(this: GameInstanceHost, player: InternalPlayerRecord, itemId: number): number {
  const exact = player.items.findIndex((i) => i.unitId === itemId)
  if (exact !== -1) return exact
  if (itemId === 1 && player.items.length === 1) return 0
  return -1
}



function handleItemDrop(this: GameInstanceHost, player: InternalPlayerRecord, itemId: number): void {
  const idx = this.findPlayerItemIndex(player, itemId)
  if (idx === -1) return
  const [item] = player.items.splice(idx, 1)
  if (!item) return
  const prevLocation = item.location

  const pos = this.findDropPosition(player.areaId, player.x, player.y, new Set())
  item.location = 'ground'
  item.ownerId = 0
  item.areaId = player.areaId
  item.x = pos.x
  item.y = pos.y
  item.bodyLoc = 0
  item.storePage = 0
  for (const child of item.socketedItems ?? []) {
    child.ownerId = item.unitId
  }
  if (item.rawItemData !== undefined) {
    const cleanFlags =
      Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0x10) & ~0x20
    item.rawItemData = {
      ...item.rawItemData,
      opcode: 0x9c,
      action: 0x02,
      ownerType: 0,
      ownerId: 0 as UnitId,
      location: 3,
      container: 'ground',
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 0,
      gridY: 0,
      storePage: 0,
      storagePage: 0,
      worldX: pos.x,
      worldY: pos.y,
      x: pos.x,
      y: pos.y,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }
  this.registerGroundItem113c(item)
  if (prevLocation === 'inventory' || prevLocation === 'equipped') {
    if (prevLocation === 'equipped') {
      this.syncPlayerItemAuras113c(player, true)
    }
    this.refreshPlayerAccruedMaxPools(player)
  }

  const itemData = this.serverEntryToItemData(item)
  this.broadcastToArea(player.areaId, {
    type: 'ItemEvent',
    action: 'drop',
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: 'ground',
    item: {
      ...itemData,
      action: 0x02,
    },
  })
  this.emitSocketChildrenToArea(player.areaId, item, 0x13)
}



function handleItemMove(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  x: number,
  y: number,
  container: 'inventory' | 'stash' | 'cube' | 'belt' | 'trade',
): void {
  const idx = this.findPlayerItemIndex(player, itemId)
  const item = idx !== -1 ? player.items[idx] : undefined
  if (!item) return

  if (container === 'trade') {
    if (!this.tradeManager.hasActiveTrade(player.unitId)) return
    if (this.isUntradableQuestItem113c(item)) return
  }

  const gridW =
    container === 'stash'
      ? 6
      : container === 'cube'
        ? 3
        : container === 'trade'
          ? TRADE_GRID_WIDTH_113C
          : 10
  const gridH =
    container === 'stash'
      ? 8
      : container === 'cube'
        ? 4
        : container === 'trade'
          ? TRADE_GRID_HEIGHT_113C
          : 4
  if (x < 0 || y < 0 || x + item.width > gridW || y + item.height > gridH) {
    return
  }

  const overlaps: ServerItemEntry[] = []
  for (const other of player.items) {
    if (other.unitId === item.unitId || other.location !== container) continue
    const overlapX = x < other.x + other.width && x + item.width > other.x
    const overlapY = y < other.y + other.height && y + item.height > other.y
    if (overlapX && overlapY) overlaps.push(other)
  }
  if (overlaps.length > 0) {
    if (
      container !== 'trade' &&
      overlaps.length === 1 &&
      item.code.trim().toLowerCase() === 'key' &&
      overlaps[0]!.code.trim().toLowerCase() === 'key'
    ) {
      const target = overlaps[0]!
      const curQty = Math.max(1, target.quantity || 1)
      const srcQty = Math.max(1, item.quantity || 1)
      if (curQty < 12) {
        const addQty = Math.min(12 - curQty, srcQty)
        target.quantity = curQty + addQty
        if (target.rawItemData !== undefined) {
          target.rawItemData = { ...target.rawItemData, quantity: target.quantity }
        }
        if (srcQty > addQty) {
          item.quantity = srcQty - addQty
          if (item.rawItemData !== undefined) {
            item.rawItemData = { ...item.rawItemData, quantity: item.quantity }
          }
          this.emitToPlayer(player.unitId, {
            type: 'ItemEvent',
            action: 'update',
            itemId: item.unitId,
            code: item.code,
            x: item.x,
            y: item.y,
            container: toItemContainer(item.location),
            item: this.serverEntryToItemData(item),
          })
        } else {
          player.items.splice(idx, 1)
        }
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'update',
          itemId: target.unitId,
          code: target.code,
          x: target.x,
          y: target.y,
          container: toItemContainer(container),
          item: this.serverEntryToItemData(target),
        })
        return
      }
    }
    return
  }

  const prevLocation = item.location
  const nextStorePage =
    container === 'stash'
      ? 5
      : container === 'cube'
        ? 4
        : container === 'trade'
          ? 3
          : container === 'belt'
            ? 0
            : 1
  item.location = container
  item.x = x
  item.y = y
  item.storePage = nextStorePage
  if (item.rawItemData !== undefined) {
    const cleanFlags = Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0x10) & ~0x20
    item.rawItemData = {
      ...item.rawItemData,
      location: container === 'belt' ? 2 : 0,
      container: toItemContainer(container),
      gridX: x,
      gridY: y,
      x,
      y,
      storePage: nextStorePage,
      storagePage: nextStorePage,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }
  if (prevLocation === 'inventory' || container === 'inventory') {
    this.refreshPlayerAccruedMaxPools(player)
  }
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'move',
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: toItemContainer(item.location),
    item: this.serverEntryToItemData(item),
  })

  const partnerId = this.tradeManager.getPartnerId(player.unitId)
  if (container === 'trade') {
    if (partnerId !== undefined) {
      this.emitPartnerTradeItemAdd(partnerId, item)
    }
    this.emitTradeEvents(this.tradeManager.notifyItemAdded(player.unitId))
  } else if (prevLocation === 'trade') {
    if (partnerId !== undefined) {
      this.emitPartnerTradeItemRemove(partnerId, item)
    }
    this.emitTradeEvents(
      this.tradeManager.notifyItemRemovedOrSwapped(player.unitId, this.currentFrame),
    )
  }
}



function handleItemEquip(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  slot: number,
  removeOppositeHand = false,
): void {
  const idx = this.findPlayerItemIndex(player, itemId)
  const item = idx !== -1 ? player.items[idx] : undefined
  if (!item) return

  const rejectEquip = (): void => {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
  }

  const oppositeSlot =
    removeOppositeHand
      ? slot === 4
        ? 5
        : slot === 5
          ? 4
          : slot === 11
            ? 12
            : slot === 12
              ? 11
              : 0
      : 0

  const currentlyEquipped = player.items.filter(
    (other) => other.unitId !== item.unitId && other.location === 'equipped',
  )
  const explicitOpposite =
    oppositeSlot > 0
      ? currentlyEquipped.find((other) => other.bodyLoc === oppositeSlot)
      : undefined
  const combat = this.playerCombat.get(player.unitId)
  const check = canUnitEquipItem113c(
    {
      kind: 'player',
      level: player.level,
      baseStrength: player.strength,
      baseDexterity: player.dexterity,
      classCode: player.classCode,
    },
    item,
    slot,
    currentlyEquipped,
    {
      dropTables: getEmbeddedDropTables(),
      computeAttributesWithoutDisplaced: (displacedItems) => {
        const allDisplaced =
          explicitOpposite !== undefined && !displacedItems.includes(explicitOpposite)
            ? [...displacedItems, explicitOpposite]
            : displacedItems
        const savedLocations = allDisplaced.map((d) => d.location)
        try {
          for (const d of allDisplaced) d.location = 'cursor'
          return {
            strength:
              player.strength +
              this.sumPlayerItemStat(player, 0) +
              (combat === undefined ? 0 : combat.statList.getModifierBonus('strength')),
            dexterity:
              player.dexterity +
              this.sumPlayerItemStat(player, 2) +
              (combat === undefined ? 0 : combat.statList.getModifierBonus('dexterity')),
          }
        } finally {
          for (let i = 0; i < allDisplaced.length; i++) {
            allDisplaced[i]!.location = savedLocations[i]!
          }
        }
      },
    },
  )
  if (!check.allowed) {
    rejectEquip()
    return
  }

  const toDisplace: ServerItemEntry[] = [...check.displacedItems]
  if (explicitOpposite !== undefined && !toDisplace.includes(explicitOpposite)) {
    toDisplace.push(explicitOpposite)
  }

  const prevItemSnapshot = {
    location: item.location,
    bodyLoc: item.bodyLoc,
    storePage: item.storePage,
    x: item.x,
    y: item.y,
  }
  const displacedSnapshots = toDisplace.map((other) => ({
    item: other,
    location: other.location,
    bodyLoc: other.bodyLoc,
    storePage: other.storePage,
    x: other.x,
    y: other.y,
  }))

  // Reserve `item` on the body first so any inventory cells it previously occupied are freed.
  item.location = 'equipped'
  item.bodyLoc = slot
  item.storePage = 0

  let cursorAvailable = !player.items.some(
    (candidate) => candidate.unitId !== item.unitId && candidate.location === 'cursor',
  )
  const plannedDisplacements: {
    readonly other: ServerItemEntry
    readonly dest: 'inventory' | 'cursor'
    readonly x: number
    readonly y: number
    readonly storePage: number
  }[] = []
  let spaceFailed = false
  for (const other of toDisplace) {
    const free = this.findFreeGridSlot(
      player,
      'inventory',
      other.width,
      other.height,
      10,
      4,
    )
    if (free !== undefined) {
      other.location = 'inventory'
      other.bodyLoc = 0
      other.x = free.x
      other.y = free.y
      other.storePage = 1
      plannedDisplacements.push({
        other,
        dest: 'inventory',
        x: free.x,
        y: free.y,
        storePage: 1,
      })
    } else if (cursorAvailable && prevItemSnapshot.location === 'cursor') {
      cursorAvailable = false
      other.location = 'cursor'
      other.bodyLoc = 0
      other.x = 0
      other.y = 0
      other.storePage = 0
      plannedDisplacements.push({
        other,
        dest: 'cursor',
        x: 0,
        y: 0,
        storePage: 0,
      })
    } else {
      spaceFailed = true
      break
    }
  }

  if (spaceFailed) {
    item.location = prevItemSnapshot.location
    item.bodyLoc = prevItemSnapshot.bodyLoc
    item.storePage = prevItemSnapshot.storePage
    item.x = prevItemSnapshot.x
    item.y = prevItemSnapshot.y
    for (const snap of displacedSnapshots) {
      snap.item.location = snap.location
      snap.item.bodyLoc = snap.bodyLoc
      snap.item.storePage = snap.storePage
      snap.item.x = snap.x
      snap.item.y = snap.y
    }
    rejectEquip()
    return
  }

  for (const plan of plannedDisplacements) {
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'unequip',
      itemId: plan.other.unitId,
      code: plan.other.code,
      x: plan.x,
      y: plan.y,
      container: plan.dest,
      item: this.serverEntryToItemData(plan.other),
    })
  }

  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'equip',
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: 'equipment',
    item: this.serverEntryToItemData(item),
  })
  this.validatePlayerActiveSkills(player)
  this.syncPlayerItemAuras113c(player, true)
  this.refreshPlayerAccruedMaxPools(player)
}



function handleItemUnequip(this: GameInstanceHost, player: InternalPlayerRecord, slot: number): void {
  const item = player.items.find(
    (i) => i.location === 'equipped' && i.bodyLoc === slot,
  )
  if (!item) return
  const free = this.findFreeGridSlot(
    player,
    'inventory',
    item.width,
    item.height,
    10,
    4,
  )
  item.location = 'inventory'
  item.bodyLoc = 0
  item.x = free?.x ?? 0
  item.y = free?.y ?? 0
  item.storePage = 1
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'unequip',
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: 'inventory',
    item: this.serverEntryToItemData(item),
  })
  this.validatePlayerActiveSkills(player)
  this.syncPlayerItemAuras113c(player, true)
  this.refreshPlayerAccruedMaxPools(player)
}



function handleSwapWeapons(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const movedItems: ServerItemEntry[] = []
  for (const item of player.items) {
    if (item.location !== 'equipped') continue
    if (item.bodyLoc === 4) {
      item.bodyLoc = 11
      movedItems.push(item)
    } else if (item.bodyLoc === 11) {
      item.bodyLoc = 4
      movedItems.push(item)
    } else if (item.bodyLoc === 5) {
      item.bodyLoc = 12
      movedItems.push(item)
    } else if (item.bodyLoc === 12) {
      item.bodyLoc = 5
      movedItems.push(item)
    }
  }
  player.weaponSet = player.weaponSet === 1 ? 0 : 1
  const prevLeft = player.leftSkill
  const prevRight = player.rightSkill
  const prevLeftItemId = player.leftSkillItemId
  const prevRightItemId = player.rightSkillItemId
  player.leftSkill = player.altLeftSkill
  player.rightSkill = player.altRightSkill
  player.leftSkillItemId = player.altLeftSkillItemId
  player.rightSkillItemId = player.altRightSkillItemId
  player.altLeftSkill = prevLeft
  player.altRightSkill = prevRight
  player.altLeftSkillItemId = prevLeftItemId
  player.altRightSkillItemId = prevRightItemId

  for (const item of movedItems) {
    if (item.rawItemData !== undefined) {
      item.rawItemData = {
        ...item.rawItemData,
        bodyLoc: item.bodyLoc,
        equippedSlot: item.bodyLoc,
      }
    }
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x17,
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: 'equipment',
      item: this.serverEntryToItemData(item),
    })
    this.emitSocketChildrenToPlayer(player.unitId, item, 0x13)
  }
  this.emitToPlayer(player.unitId, {
    type: 'WeaponSwitch',
  })
  if (player.leftSkill !== prevLeft || player.leftSkillItemId !== prevLeftItemId) {
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'left',
      skill: player.leftSkill,
      itemId: player.leftSkillItemId ?? 0xffffffff,
    })
  }
  if (player.rightSkill !== prevRight || player.rightSkillItemId !== prevRightItemId) {
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'right',
      skill: player.rightSkill,
      itemId: player.rightSkillItemId ?? 0xffffffff,
    })
  }
  this.validatePlayerActiveSkills(player)
  this.syncPlayerSelectedRightAura113c(player)
  this.syncPlayerItemAuras113c(player, true)
  this.refreshPlayerAccruedMaxPools(player)
}



/**
 * 1.13c `D2Common_CanUnitEquipItem` mercenary equipment slot compatibility:
 * - Head (`1`): `helm`, `circ` (all acts), plus `phlm` primal helms on Act 5 Barbarian.
 * - Torso (`3`): `tors` (all acts).
 * - Weapon / Shield (`4` / `5`):
 *   - Act 1 Rogue: `bow` -> `4`
 *   - Act 2 Desert Mercenary: `pole`, `spea`, `jave` -> `4`
 *   - Act 3 Iron Wolf: 1H `swor` -> `4`, `shie` -> `5`
 *   - Act 5 Barbarian: 1H/2H `swor` -> `4`
 */
function resolveMercDefaultBodyLoc113c(this: GameInstanceHost, code: string, act: 1 | 2 | 3 | 5): number | undefined {
  const info = lookupBaseInfo(code)
  const t = info.itemType
  if (t === 'helm' || t === 'circ' || (act === 5 && t === 'phlm')) return 1
  if (t === 'tors') return 3
  if (act === 1) {
    if (t === 'bow') return 4
    return undefined
  }
  if (act === 2) {
    if (t === 'pole' || t === 'spea' || t === 'jave') return 4
    return undefined
  }
  if (act === 3) {
    if (t === 'swor' && !info.twoHanded) return 4
    if (t === 'shie') return 5
    return undefined
  }
  if (act === 5) {
    if (t === 'swor') return 4
    return undefined
  }
  return undefined
}



/**
 * 1.13c `SCMD_MercItem` (`0x61`, `D2Game.dll` `0x6FCF0BC0`):
 * - `rawSlot === 0xffff`: feed cursor healing/rejuvenation potion to the player's alive mercenary.
 * - Empty cursor + `rawSlot` in `{1, 3, 4, 5}`: unequip mercenary slot to cursor (`0x9D` `action: 0x08`).
 * - Item on cursor: equip onto mercenary body slot (`0x9D` `action: 0x06`), swapping any displaced
 *   merc item back to the player's cursor (`0x9D` `action: 0x08`), and refresh `syncMercenaryOwnerAura`.
 */
function handleMercItem(this: GameInstanceHost, player: InternalPlayerRecord, rawSlot: number): void {
  const merc = [...this.mercenaries.values()].find(
    (m) => m.ownerPlayerId === player.unitId && m.alive && m.hp > 0,
  )
  if (!merc) return

  const cursorIdx = player.items.findIndex((i) => i.location === 'cursor')
  const cursorItem = cursorIdx !== -1 ? player.items[cursorIdx] : undefined

  if (rawSlot === 0xffff) {
    if (!cursorItem) return
    const code = cursorItem.code.trim().toLowerCase()
    const isRejuv = code === 'rvl' || code === 'rvs' || code.startsWith('rv')
    const isHeal = code.startsWith('hp')
    if (!isRejuv && !isHeal) return
    const cursorDeletedBase = this.serverEntryToItemData(cursorItem)
    const cursorDeletedFlags = ((cursorDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    player.items.splice(cursorIdx, 1)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: cursorItem.unitId,
      code: cursorItem.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: {
        ...cursorDeletedBase,
        flags: cursorDeletedFlags,
        rawFlags: cursorDeletedFlags,
      },
    })
    const healDelta =
      code === 'rvl'
        ? merc.maxHp
        : code === 'rvs'
          ? Math.max(1, Math.floor((merc.maxHp * 35) / 100))
          : code === 'hp5'
            ? 320
            : code === 'hp4'
              ? 180
              : code === 'hp3'
                ? 100
                : code === 'hp2'
                  ? 60
                  : 30
    const nextHp = Math.min(merc.maxHp, merc.hp + healDelta)
    if (nextHp !== merc.hp) {
      merc.hp = nextHp
      this.mercCombat.get(merc.unitId)?.statList.setHp256(merc.hp * FIXED_ONE)
      this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
    }
    return
  }

  if (!cursorItem) {
    if (rawSlot !== 1 && rawSlot !== 3 && rawSlot !== 4 && rawSlot !== 5) return
    let eqIdx = merc.equipment.findIndex((e) => e.bodyLoc === rawSlot)
    if (eqIdx === -1 && rawSlot === 5) {
      eqIdx = merc.equipment.findIndex((e) => e.bodyLoc === 4)
    }
    if (eqIdx === -1) return
    const [removed] = merc.equipment.splice(eqIdx, 1)
    if (!removed) return
    removed.ownerId = player.unitId
    removed.location = 'cursor'
    removed.bodyLoc = 0
    removed.x = 0
    removed.y = 0
    removed.storePage = 0
    if (removed.rawItemData !== undefined) {
      removed.rawItemData = {
        ...removed.rawItemData,
        ownerType: 0,
        ownerId: player.unitId as UnitId,
        location: 4,
        bodyLoc: 0,
        equippedSlot: 0,
      }
    }
    player.items.push(removed)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x08,
      itemId: removed.unitId,
      code: removed.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: {
        ...this.serverEntryToItemData(removed),
        opcode: 0x9d,
        action: 0x08,
        ownerType: 0,
        ownerId: player.unitId as UnitId,
        location: 4,
        bodyLoc: 0,
        equippedSlot: 0,
      },
    })
    this.syncMercenaryOwnerAura(player, merc.activeAura, merc, true)
    return
  }

  const rejectMercEquip = (): void => {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
  }

  const defaultSlot = this.resolveMercDefaultBodyLoc113c(cursorItem.code, merc.act)
  const candidateReq = computeItemRequirements113c(cursorItem, {
    dropTables: getEmbeddedDropTables(),
    includeWeaponSwap: false,
  })
  const inferredSlot = defaultSlot ?? candidateReq.validSlots[0]
  if (inferredSlot === undefined) {
    rejectMercEquip()
    return
  }
  const targetSlot =
    rawSlot === 0 ||
    rawSlot === inferredSlot ||
    (inferredSlot === 4 && (rawSlot === 4 || rawSlot === 5)) ||
    (inferredSlot === 5 && (rawSlot === 4 || rawSlot === 5))
      ? inferredSlot
      : undefined
  if (targetSlot === undefined) {
    rejectMercEquip()
    return
  }

  const mercStats = resolveHirelingStatsAtLevel(
    merc.subType,
    merc.act,
    merc.difficulty,
    merc.level,
    true,
  )
  const mercCombat = this.mercCombat.get(merc.unitId)
  const check = canUnitEquipItem113c(
    {
      kind: 'mercenary',
      mercAct: merc.act,
      level: merc.level,
      baseStrength: mercStats?.str ?? 0,
      baseDexterity: mercStats?.dex ?? 0,
    },
    cursorItem,
    targetSlot,
    merc.equipment,
    {
      dropTables: getEmbeddedDropTables(),
      computeAttributesWithoutDisplaced: (displacedItems) => {
        const savedEquip = [...merc.equipment]
        try {
          if (displacedItems.length > 0) {
            merc.equipment = savedEquip.filter((eq) => !displacedItems.includes(eq))
          }
          return {
            strength:
              (mercStats?.str ?? 0) +
              this.sumMercItemStat(merc, 0) +
              (mercCombat === undefined ? 0 : mercCombat.statList.getModifierBonus('strength')),
            dexterity:
              (mercStats?.dex ?? 0) +
              this.sumMercItemStat(merc, 2) +
              (mercCombat === undefined ? 0 : mercCombat.statList.getModifierBonus('dexterity')),
          }
        } finally {
          merc.equipment = savedEquip
        }
      },
    },
  )
  if (!check.allowed || check.displacedItems.length > 1) {
    rejectMercEquip()
    return
  }
  const displaced = check.displacedItems

  player.items.splice(cursorIdx, 1)
  if (displaced.length === 1) {
    const prev = displaced[0]!
    const prevIdx = merc.equipment.indexOf(prev)
    if (prevIdx !== -1) merc.equipment.splice(prevIdx, 1)
  }

  cursorItem.ownerId = merc.unitId
  cursorItem.location = 'equipped'
  cursorItem.bodyLoc = targetSlot
  cursorItem.x = 0
  cursorItem.y = 0
  cursorItem.storePage = 0
  if (cursorItem.rawItemData !== undefined) {
    cursorItem.rawItemData = {
      ...cursorItem.rawItemData,
      ownerType: 1,
      ownerId: merc.unitId as UnitId,
      location: 1,
      bodyLoc: targetSlot,
      equippedSlot: targetSlot,
    }
  }
  merc.equipment.push(cursorItem)
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x06,
    itemId: cursorItem.unitId,
    code: cursorItem.code,
    x: 0,
    y: 0,
    container: 'equipment',
    item: {
      ...this.serverEntryToItemData(cursorItem),
      opcode: 0x9d,
      action: 0x06,
      ownerType: 1,
      ownerId: merc.unitId as UnitId,
      location: 1,
      bodyLoc: targetSlot,
      equippedSlot: targetSlot,
    },
  })

  if (displaced.length === 1) {
    const prev = displaced[0]!
    prev.ownerId = player.unitId
    prev.location = 'cursor'
    prev.bodyLoc = 0
    prev.x = 0
    prev.y = 0
    prev.storePage = 0
    if (prev.rawItemData !== undefined) {
      prev.rawItemData = {
        ...prev.rawItemData,
        ownerType: 0,
        ownerId: player.unitId as UnitId,
        location: 4,
        bodyLoc: 0,
        equippedSlot: 0,
      }
    }
    player.items.push(prev)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x08,
      itemId: prev.unitId,
      code: prev.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: {
        ...this.serverEntryToItemData(prev),
        opcode: 0x9d,
        action: 0x08,
        ownerType: 0,
        ownerId: player.unitId as UnitId,
        location: 4,
        bodyLoc: 0,
        equippedSlot: 0,
      },
    })
  }

  this.syncMercenaryOwnerAura(player, merc.activeAura, merc, true)
}



function getPlayerBeltMaxRows(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const belt = player.items.find(
    (item) => item.location === 'equipped' && item.bodyLoc === 8,
  )
  if (!belt) return NO_BELT_ROWS
  return BELT_CODE_TO_ROWS[belt.code.trim().toLowerCase()] ?? 4
}



function getBeltColRow(this: GameInstanceHost, it: ServerItemEntry): { col: number; row: number } {
  if (it.y > 0) {
    return { col: it.x & 3, row: it.y }
  }
  return { col: it.x & 3, row: (it.x >> 2) & 3 }
}



function setBeltEntryColRow(this: GameInstanceHost, it: ServerItemEntry, col: number, row: number): number {
  const c = col & 3
  const r = Math.max(0, Math.min(3, row))
  const linearSlot = (r * 4 + c) & 0x0f
  it.location = 'belt'
  it.x = c
  it.y = r
  it.storePage = 0
  if (it.rawItemData !== undefined) {
    const cleanFlags = Number(it.rawItemData.rawFlags ?? it.rawItemData.flags ?? 0x10) & ~0x20
    it.rawItemData = {
      ...it.rawItemData,
      location: 2,
      container: 'belt',
      gridX: linearSlot,
      gridY: 0,
      x: linearSlot,
      y: 0,
      storePage: 0,
      storagePage: 0,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }
  return linearSlot
}



function shiftBeltColumnDown(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  col: number,
  removedRow: number,
): void {
  const above = player.items
    .filter((it) => {
      if (it.location !== 'belt') return false
      const pos = this.getBeltColRow(it)
      return pos.col === (col & 3) && pos.row > removedRow
    })
    .sort((a, b) => this.getBeltColRow(a).row - this.getBeltColRow(b).row)

  for (const upper of above) {
    const pos = this.getBeltColRow(upper)
    const nextLinear = this.setBeltEntryColRow(upper, pos.col, pos.row - 1)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'beltPut',
      itemId: upper.unitId,
      code: upper.code,
      x: nextLinear,
      y: 0,
      container: 'belt',
      item: this.serverEntryToItemData(upper),
    })
  }
}



function handleBeltPut(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  slot: number,
): void {
  const idx = this.findPlayerItemIndex(player, itemId)
  const item = idx !== -1 ? player.items[idx] : undefined
  if (!item || item.width !== 1 || item.height !== 1) return
  if (BELT_POTION_CATALOG[item.code.trim().toLowerCase()] === undefined) return
  const clamped = Math.max(0, Math.min(15, Math.trunc(slot)))
  const col = clamped & 3
  const row = clamped >> 2
  if (row >= this.getPlayerBeltMaxRows(player)) return
  const occupied = player.items.some((other) => {
    if (other.unitId === item.unitId || other.location !== 'belt') return false
    const pos = this.getBeltColRow(other)
    return pos.col === col && pos.row === row
  })
  if (occupied) return
  const prevLocation = item.location
  const linearSlot = this.setBeltEntryColRow(item, col, row)
  if (prevLocation === 'inventory') {
    this.refreshPlayerAccruedMaxPools(player)
  }
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'beltPut',
    itemId: item.unitId,
    code: item.code,
    x: linearSlot,
    y: 0,
    container: 'belt',
    item: this.serverEntryToItemData(item),
  })
}



/**
 * 1.13c `C2S 0x24` (`RemoveBeltItem`, `D2Game.dll` `0x6FCF0F80`):
 * Moves the targeted belt potion/scroll onto the player's cursor (`location = 'cursor'`)
 * without consuming it, and shifts upper potions in the same belt column down by 1 row.
 */
function handleBeltRemoveToCursor(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
): void {
  if (player.items.some((candidate) => candidate.location === 'cursor')) return
  const item = player.items.find(
    (candidate) => candidate.unitId === itemId && candidate.location === 'belt',
  )
  if (!item) return
  const { col, row } = this.getBeltColRow(item)
  item.location = 'cursor'
  item.x = 0
  item.y = 0
  item.storePage = 0
  if (item.rawItemData !== undefined) {
    const cleanFlags = Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0x10) & ~0x20
    item.rawItemData = {
      ...item.rawItemData,
      location: 4,
      container: 'cursor',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      storePage: 0,
      storagePage: 0,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x0f,
    itemId: item.unitId,
    code: item.code,
    x: 0,
    y: 0,
    container: 'cursor',
    item: {
      ...this.serverEntryToItemData(item),
      location: 4,
      container: 'cursor',
    },
  })
  this.shiftBeltColumnDown(player, col, row)
}



function handleBeltUse(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  useOnMerc = false,
): void {
  if (player.dead || this.isPlayerWhirlwinding113c(player)) return
  const idx = this.findPlayerItemIndex(player, itemId)
  if (idx === -1) return
  const candidate = player.items[idx]
  if (!candidate) return

  const itemCode = candidate.code.toLowerCase().trim()

  if (useOnMerc) {
    let aliveMerc: InternalMercenaryRecord | undefined
    for (const m of this.mercenaries.values()) {
      if (m.ownerPlayerId === player.unitId && m.alive && m.hp > 0) {
        aliveMerc = m
        break
      }
    }
    const catalog = BELT_POTION_CATALOG[itemCode]
    const usableOnMerc =
      aliveMerc !== undefined &&
      (itemCode === 'rvs' ||
        itemCode === 'rvl' ||
        catalog?.kind === 'hp' ||
        catalog?.kind === 'antidote' ||
        catalog?.kind === 'thawing')
    if (!usableOnMerc || !aliveMerc) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    const wasBelt = candidate.location === 'belt'
    const beltPos = wasBelt ? this.getBeltColRow(candidate) : undefined
    const deletedBase = this.serverEntryToItemData(candidate)
    const deletedFlags = ((deletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    const [item] = player.items.splice(idx, 1)
    if (!item) return

    if (wasBelt && beltPos !== undefined) {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 0x0f,
        itemId: item.unitId,
        code: item.code,
        x: deletedBase.gridX,
        y: 0,
        container: 'belt',
        item: {
          ...deletedBase,
          flags: deletedFlags,
          rawFlags: deletedFlags,
        },
      })
      this.shiftBeltColumnDown(player, beltPos.col, beltPos.row)
    } else {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: toItemContainer(item.location),
        item: {
          ...deletedBase,
          flags: deletedFlags,
          rawFlags: deletedFlags,
        },
      })
    }

    if (itemCode === 'rvl') {
      aliveMerc.hp = aliveMerc.maxHp
    } else if (itemCode === 'rvs') {
      const heal = Math.max(1, Math.floor((aliveMerc.maxHp * 35) / 100))
      aliveMerc.hp = Math.min(aliveMerc.maxHp, aliveMerc.hp + heal)
    } else if (catalog?.kind === 'hp') {
      aliveMerc.hp = Math.min(aliveMerc.maxHp, aliveMerc.hp + catalog.healHp)
    } else if (itemCode === 'yps') {
      // 1.13c Antidote Potion (`Misc.txt` `yps`, `D2Game.dll` `ITEMS_UsePotion`, #1989):
      // Cures `STATE_POISON` (`2`) and stacks `+750` frames (`30s`) onto `STATE_ANTIDOTE` (`178`: `+50%` Poison Res, `+10%` Max Poison Res).
      const mercCtx = this.mercCombatContext(aliveMerc)
      mercCtx.stateBus.removeState(2)
      mercCtx.stateBus.removeState('poison')
      if (aliveMerc.states.has(2)) {
        this.clearUnitState(
          aliveMerc.states,
          aliveMerc.stateTimers,
          'monster',
          aliveMerc.unitId,
          aliveMerc.areaId,
          2,
        )
      }
      const prevDur = aliveMerc.states.has(178) ? (aliveMerc.stateTimers.get(178) ?? 0) : 0
      const nextDur = prevDur + 750
      mercCtx.stateBus.applyState({
        stateNameOrId: 178,
        sourceUnitId: `player_${player.unitId}`,
        durationFrames: nextDur,
        currentFrame: this.currentFrame,
        stats: { poisonresist: 50, maxpoisonresist: 10 },
      })
      this.applyUnitState(
        aliveMerc.states,
        aliveMerc.stateTimers,
        'monster',
        aliveMerc.unitId,
        aliveMerc.areaId,
        178,
        nextDur,
      )
    } else if (itemCode === 'wms') {
      // 1.13c Thawing Potion (`Misc.txt` `wms`, `D2Game.dll` `ITEMS_UsePotion`, #1989):
      // Cures `STATE_FREEZE` (`1`) & `STATE_COLD` (`11`) and stacks `+750` frames (`30s`) onto `STATE_THAWING` (`179`: `+50%` Cold Res, `+10%` Max Cold Res).
      const mercCtx = this.mercCombatContext(aliveMerc)
      for (const coldStateId of [1, 11] as const) {
        mercCtx.stateBus.removeState(coldStateId)
        if (aliveMerc.states.has(coldStateId)) {
          this.clearUnitState(
            aliveMerc.states,
            aliveMerc.stateTimers,
            'monster',
            aliveMerc.unitId,
            aliveMerc.areaId,
            coldStateId,
          )
        }
      }
      const prevDur = aliveMerc.states.has(179) ? (aliveMerc.stateTimers.get(179) ?? 0) : 0
      const nextDur = prevDur + 750
      mercCtx.stateBus.applyState({
        stateNameOrId: 179,
        sourceUnitId: `player_${player.unitId}`,
        durationFrames: nextDur,
        currentFrame: this.currentFrame,
        stats: { coldresist: 50, maxcoldresist: 10 },
      })
      this.applyUnitState(
        aliveMerc.states,
        aliveMerc.stateTimers,
        'monster',
        aliveMerc.unitId,
        aliveMerc.areaId,
        179,
        nextDur,
      )
    }
    this.broadcastAllyHp(aliveMerc.areaId, aliveMerc.unitId, aliveMerc.hp)
    return
  }

  // 1.13c consumable quest items (`D2Game.dll` @ `0x6fcf9e73..0x6fcf9f52`):
  // Book of Skill ('ass'), Potion of Life ('xyz'), and Scroll of Resistance ('tr2').
  // Preconditions are checked BEFORE splicing the item so rejected uses play sound 19
  // ('impossible1') and leave the item untouched in inventory/belt.
  if (itemCode === 'ass') {
    if (!hasQuestFlag113c(player.questFlags, 'a2q1', QUEST_FLAG_CUSTOM_5_113C)) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    const [item] = player.items.splice(idx, 1)
    if (!item) return
    const assDeletedBase = this.serverEntryToItemData(item)
    const assDeletedFlags = ((assDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: {
        ...assDeletedBase,
        flags: assDeletedFlags,
        rawFlags: assDeletedFlags,
      },
    })
    clearQuestFlag113c(player.questFlags, 'a2q1', QUEST_FLAG_CUSTOM_5_113C)
    setQuestFlag113c(player.questFlags, 'a2q1', QUEST_FLAG_COMPLETED_113C)
    player.newSkills += 1
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 5,
      value: player.newSkills,
    })
    this.emitQuestFlagSync113c(player, 'a2q1')
    return
  }
  if (itemCode === 'xyz') {
    if (!hasQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_CUSTOM_5_113C)) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    const [item] = player.items.splice(idx, 1)
    if (!item) return
    const xyzDeletedBase = this.serverEntryToItemData(item)
    const xyzDeletedFlags = ((xyzDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: {
        ...xyzDeletedBase,
        flags: xyzDeletedFlags,
        rawFlags: xyzDeletedFlags,
      },
    })
    clearQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_CUSTOM_5_113C)
    setQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_COMPLETED_113C)
    // 1.13c `D2Game.dll` `0x6FD0B120..0x6FD0B142`: adds `+20 * 256` to base `STAT_MAXHP` (`7`)
    // and `STAT_HITPOINTS` (`6`), then queries accrued `D2Common.#10913` (`GetMaxLifeFromUnit`, #1996).
    player.maxHpFixed += 20 * FIXED_ONE
    player.hpFixed += 20 * FIXED_ONE
    this.refreshPlayerAccruedMaxPools(player)
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 7,
      value: player.maxHpFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
    this.emitQuestFlagSync113c(player, 'a3q1')
    return
  }
  if (itemCode === 'tr2') {
    if (
      !hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_8_113C) ||
      hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_7_113C)
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    const [item] = player.items.splice(idx, 1)
    if (!item) return
    const tr2DeletedBase = this.serverEntryToItemData(item)
    const tr2DeletedFlags = ((tr2DeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: {
        ...tr2DeletedBase,
        flags: tr2DeletedFlags,
        rawFlags: tr2DeletedFlags,
      },
    })
    setQuestFlag113c(
      player.questFlags,
      'a5q3',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_CUSTOM_7_113C,
    )
    const combat = this.playerCombatContext(player)
    for (const [statId, statName] of [
      [39, 'fireresist'],
      [41, 'lightresist'],
      [43, 'coldresist'],
      [45, 'poisonresist'],
    ] as const) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId,
        value: Math.trunc(combat.statList.getAccruedStat(statName)),
      })
    }
    this.emitQuestFlagSync113c(player, 'a5q3')
    return
  }

  if (itemCode === 'tsc' || itemCode === 'tbk') {
    this.openTownPortal(player, true, player.unitId, player.name, candidate)
    return
  }

  // 1.13c `D2Game.dll` `ITEMS_UseSpell` (`0x6FCCD0F0` -> `pSpell = 1` `preCheckFn` `0x6FCCCFD0`):
  // Using `'isc'` (inventory or belt) or `'ibk'` (`quantity > 0`) emits `S2C 0x3F UseStackableItem`
  // (`SpellIcon = 0`, `itemId = candidate.unitId`, `wSpell = 217 | 218`) WITHOUT consuming the scroll/tome;
  // consumption happens only when `C2S 0x27 IdentifyItem` (`0x6FCF9FB0`) identifies the target item.
  if (itemCode === 'isc' || itemCode === 'ibk') {
    if (itemCode === 'ibk' && (candidate.quantity ?? 0) <= 0) return
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: 0,
      hand: 'right',
      skill: itemCode === 'ibk' ? 218 : 217,
      itemId: candidate.unitId,
      isUseStackableItem: true,
    } as ServerEvent)
    return
  }

  const wasBelt = candidate.location === 'belt'
  const beltPos = wasBelt ? this.getBeltColRow(candidate) : undefined
  const deletedBase = this.serverEntryToItemData(candidate)
  const deletedFlags = ((deletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
  const [item] = player.items.splice(idx, 1)
  if (!item) return

  // 1.13c Token of Absolution ('toa', D2Game.dll 0x6fcf9f55): resets stats and skills identically to Akara Respec.
  if (itemCode === 'toa') {
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: {
        ...deletedBase,
        flags: deletedFlags,
        rawFlags: deletedFlags,
      },
    })
    this.executePlayerRespec113c(player)
    return
  }

  if (wasBelt && beltPos !== undefined) {
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x0f,
      itemId: item.unitId,
      code: item.code,
      x: deletedBase.gridX,
      y: 0,
      container: 'belt',
      item: {
        ...deletedBase,
        flags: deletedFlags,
        rawFlags: deletedFlags,
      },
    })
    this.shiftBeltColumnDown(player, beltPos.col, beltPos.row)
  } else {
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: {
        ...deletedBase,
        flags: deletedFlags,
        rawFlags: deletedFlags,
      },
    })
  }

  // 1.13c `D2Game.dll` `0x6FC967D3` / `0x6FC97240` (`ITEMS_UsePotion`): clamps `hp*`, `mp*`, `rvs`, and `rvl`
  // against accrued `D2Common.#10913` (`GetMaxLifeFromUnit`) and `D2Common.#10186` (`GetMaxManaFromUnit`, #1996).
  const catalog = BELT_POTION_CATALOG[itemCode]
  if (itemCode === 'rvl') {
    player.hpFixed = this.getPlayerAccruedMaxHpFixed(player)
    player.manaFixed = this.getPlayerAccruedMaxManaFixed(player)
    this.refreshPlayerAccruedMaxPools(player)
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 8,
      value: player.manaFixed,
    })
  } else if (itemCode === 'rvs') {
    const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
    const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
    const hpDelta = Math.max(FIXED_ONE, Math.floor((accruedMaxHpFixed * 35) / 100))
    const manaDelta = Math.max(FIXED_ONE, Math.floor((accruedMaxManaFixed * 35) / 100))
    player.hpFixed = Math.min(accruedMaxHpFixed, player.hpFixed + hpDelta)
    player.manaFixed = Math.min(accruedMaxManaFixed, player.manaFixed + manaDelta)
    this.refreshPlayerAccruedMaxPools(player)
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 8,
      value: player.manaFixed,
    })
  } else {
    if (catalog?.kind === 'hp' || itemCode.startsWith('hp')) {
      const healHp = catalog?.healHp ?? 30
      const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
      player.hpFixed = Math.min(
        accruedMaxHpFixed,
        player.hpFixed + healHp * FIXED_ONE,
      )
      this.refreshPlayerAccruedMaxPools(player)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 6,
        value: player.hpFixed,
      })
    }
    if (catalog?.kind === 'mana' || itemCode.startsWith('mp')) {
      const healMana = catalog?.healMana ?? 30
      const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
      player.manaFixed = Math.min(
        accruedMaxManaFixed,
        player.manaFixed + healMana * FIXED_ONE,
      )
      this.refreshPlayerAccruedMaxPools(player)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 8,
        value: player.manaFixed,
      })
    }
    if (itemCode === 'vps') {
      // 1.13c Stamina Potion (`Misc.txt` `vps`, `D2Game.dll` `ITEMS_UsePotion`, #1989):
      // Refills stamina to accrued max, clears exhaustion, and stacks `+750` frames (`30s`) onto `STATE_STAMINAPOT` (`180`: `+5000%` stamina recovery).
      const maxStamFixed = this.getPlayerAccruedMaxStaminaFixed(player)
      player.staminaFixed = maxStamFixed
      player.staminaExhausted = false
      player.stamina = Math.floor(player.staminaFixed / FIXED_ONE)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 10,
        value: player.staminaFixed,
      })
      const playerCtx = this.playerCombatContext(player)
      const prevDur = player.states.has(180) ? (player.stateTimers.get(180) ?? 0) : 0
      const nextDur = prevDur + 750
      playerCtx.stateBus.applyState({
        stateNameOrId: 180,
        sourceUnitId: `player_${player.unitId}`,
        durationFrames: nextDur,
        currentFrame: this.currentFrame,
        stats: { staminarecoverybonus: 5000 },
      })
      this.applyUnitState(
        player.states,
        player.stateTimers,
        'player',
        player.unitId,
        player.areaId,
        180,
        nextDur,
      )
    } else if (itemCode === 'yps') {
      // 1.13c Antidote Potion (`Misc.txt` `yps`, #1989):
      // Cures `STATE_POISON` (`2`) and stacks `+750` frames (`30s`) onto `STATE_ANTIDOTE` (`178`: `+50%` Poison Res, `+10%` Max Poison Res).
      const playerCtx = this.playerCombatContext(player)
      playerCtx.stateBus.removeState(2)
      playerCtx.stateBus.removeState('poison')
      if (player.states.has(2)) {
        this.clearUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          2,
        )
      }
      const prevDur = player.states.has(178) ? (player.stateTimers.get(178) ?? 0) : 0
      const nextDur = prevDur + 750
      playerCtx.stateBus.applyState({
        stateNameOrId: 178,
        sourceUnitId: `player_${player.unitId}`,
        durationFrames: nextDur,
        currentFrame: this.currentFrame,
        stats: { poisonresist: 50, maxpoisonresist: 10 },
      })
      this.applyUnitState(
        player.states,
        player.stateTimers,
        'player',
        player.unitId,
        player.areaId,
        178,
        nextDur,
      )
    } else if (itemCode === 'wms') {
      // 1.13c Thawing Potion (`Misc.txt` `wms`, #1989):
      // Cures `STATE_FREEZE` (`1`) & `STATE_COLD` (`11`) and stacks `+750` frames (`30s`) onto `STATE_THAWING` (`179`: `+50%` Cold Res, `+10%` Max Cold Res).
      const playerCtx = this.playerCombatContext(player)
      for (const coldStateId of [1, 11] as const) {
        playerCtx.stateBus.removeState(coldStateId)
        if (player.states.has(coldStateId)) {
          this.clearUnitState(
            player.states,
            player.stateTimers,
            'player',
            player.unitId,
            player.areaId,
            coldStateId,
          )
        }
      }
      const prevDur = player.states.has(179) ? (player.stateTimers.get(179) ?? 0) : 0
      const nextDur = prevDur + 750
      playerCtx.stateBus.applyState({
        stateNameOrId: 179,
        sourceUnitId: `player_${player.unitId}`,
        durationFrames: nextDur,
        currentFrame: this.currentFrame,
        stats: { coldresist: 50, maxcoldresist: 10 },
      })
      this.applyUnitState(
        player.states,
        player.stateTimers,
        'player',
        player.unitId,
        player.areaId,
        179,
        nextDur,
      )
    }
  }
  this.emitToPlayer(player.unitId, {
    type: 'LifeMana',
    life: player.hp,
    mana: player.mana,
    stamina: player.stamina,
    at: playerWirePosition(player),
    vx: 0,
    vy: 0,
  })
}



function findFreeGridSlot(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  container: 'inventory' | 'stash' | 'cube',
  w: number,
  h: number,
  gridW: number,
  gridH: number,
): { x: number; y: number } | undefined {
  for (let y = 0; y <= gridH - h; y++) {
    for (let x = 0; x <= gridW - w; x++) {
      let collision = false
      for (const other of player.items) {
        if (other.location !== container) continue
        const ox = x < other.x + other.width && x + w > other.x
        const oy = y < other.y + other.height && y + h > other.y
        if (ox && oy) {
          collision = true
          break
        }
      }
      if (!collision) return { x, y }
    }
  }
  return undefined
}



function handleItemToCursor(this: GameInstanceHost, player: InternalPlayerRecord, itemId: number): void {
  const item = player.items.find(
    (candidate) =>
      candidate.unitId === itemId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube' ||
        candidate.location === 'trade'),
  )
  if (!item || player.items.some((candidate) => candidate.location === 'cursor')) return
  const prevLocation = item.location
  const prevX = item.x
  const prevY = item.y
  item.location = 'cursor'
  item.x = 0
  item.y = 0
  item.storePage = 0
  if (item.rawItemData !== undefined) {
    const cleanFlags = Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0x10) & ~0x20
    item.rawItemData = {
      ...item.rawItemData,
      location: 4,
      container: 'cursor',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      storePage: 0,
      storagePage: 0,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }
  if (prevLocation === 'inventory') {
    this.refreshPlayerAccruedMaxPools(player)
  }
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x05,
    itemId: item.unitId,
    code: item.code,
    x: 0,
    y: 0,
    container: 'cursor',
    item: this.serverEntryToItemData(item),
  })
  if (prevLocation === 'trade') {
    const partnerId = this.tradeManager.getPartnerId(player.unitId)
    if (partnerId !== undefined) {
      this.emitPartnerTradeItemRemove(partnerId, item, prevX, prevY)
    }
    this.emitTradeEvents(
      this.tradeManager.notifyItemRemovedOrSwapped(player.unitId, this.currentFrame),
    )
  }
}



function syncServerItemQuantity(this: GameInstanceHost, entry: ServerItemEntry, nextQty: number): void {
  const clamped = Math.max(0, Math.trunc(nextQty))
  entry.quantity = clamped
  entry.stats.set(70, clamped)
  if (entry.rawItemData !== undefined) {
    const prevStats = entry.rawItemData.stats ?? []
    let found70 = false
    const updatedStats = prevStats.map((s) => {
      if (s.statId === 70) {
        found70 = true
        return { ...s, value: clamped }
      }
      return s
    })
    if (!found70) {
      updatedStats.push({ statId: 70, param: 0, value: clamped })
    }
    entry.rawItemData = {
      ...entry.rawItemData,
      quantity: clamped,
      stats: updatedStats,
    }
  }
}



/**
 * 1.13c `C2S 0x1F` (`SwapContainerItem`, `D2Game.dll` `0x6FCF1010` -> `0x6FC859F0`):
 * Atomically swaps `cursorItem` with `targetItem` inside `inventory` (`10x4`), `cube` (`3x4`), or `stash` (`6x8`).
 * Rejects without mutation if `(x, y)` is out of bounds or overlaps any item other than `targetItem` (e.g., >=2 items).
 */
function handleSwapContainerItem(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cursorItemId: number,
  targetItemId: number,
  x: number,
  y: number,
): void {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return
  const cursorItem = player.items.find(
    (candidate) => candidate.unitId === cursorItemId && candidate.location === 'cursor',
  )
  const targetItem = player.items.find(
    (candidate) =>
      candidate.unitId === targetItemId &&
      candidate.unitId !== cursorItemId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube' ||
        candidate.location === 'trade'),
  )
  if (!cursorItem || !targetItem) return

  const container = targetItem.location as 'inventory' | 'stash' | 'cube' | 'trade'
  if (container === 'trade') {
    if (!this.tradeManager.hasActiveTrade(player.unitId)) return
    if (this.isUntradableQuestItem113c(cursorItem)) return
  }
  const gridW =
    container === 'stash'
      ? 6
      : container === 'cube'
        ? 3
        : container === 'trade'
          ? TRADE_GRID_WIDTH_113C
          : 10
  const gridH =
    container === 'stash'
      ? 8
      : container === 'cube'
        ? 4
        : container === 'trade'
          ? TRADE_GRID_HEIGHT_113C
          : 4
  if (
    x < 0 ||
    y < 0 ||
    x + cursorItem.width > gridW ||
    y + cursorItem.height > gridH
  ) {
    return
  }

  for (const other of player.items) {
    if (
      other.location !== container ||
      other.unitId === targetItem.unitId ||
      other.unitId === cursorItem.unitId
    ) {
      continue
    }
    const overlapX = x < other.x + other.width && x + cursorItem.width > other.x
    const overlapY = y < other.y + other.height && y + cursorItem.height > other.y
    if (overlapX && overlapY) {
      return
    }
  }

  const prevTargetX = targetItem.x
  const prevTargetY = targetItem.y
  const storePage =
    container === 'stash' ? 5 : container === 'cube' ? 4 : container === 'trade' ? 3 : 1
  const wireContainer = toItemContainer(container)
  cursorItem.location = container
  cursorItem.x = x
  cursorItem.y = y
  cursorItem.storePage = storePage
  if (cursorItem.rawItemData !== undefined) {
    const cleanFlags = Number(cursorItem.rawItemData.rawFlags ?? 0x10) & ~0x20
    cursorItem.rawItemData = {
      ...cursorItem.rawItemData,
      location: 0,
      container: wireContainer,
      gridX: x,
      gridY: y,
      x,
      y,
      storePage,
      storagePage: storePage,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }

  targetItem.location = 'cursor'
  targetItem.x = 0
  targetItem.y = 0
  targetItem.storePage = 0
  if (targetItem.rawItemData !== undefined) {
    const cleanFlags = Number(targetItem.rawItemData.rawFlags ?? 0x10) & ~0x20
    targetItem.rawItemData = {
      ...targetItem.rawItemData,
      location: 4,
      container: 'cursor',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      storePage: 0,
      storagePage: 0,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }

  if (container === 'inventory') {
    this.refreshPlayerAccruedMaxPools(player)
  }

  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x0d,
    itemId: cursorItem.unitId,
    code: cursorItem.code,
    x: cursorItem.x,
    y: cursorItem.y,
    container: wireContainer,
    item: this.serverEntryToItemData(cursorItem),
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x05,
    itemId: targetItem.unitId,
    code: targetItem.code,
    x: 0,
    y: 0,
    container: 'cursor',
    item: {
      ...this.serverEntryToItemData(targetItem),
      location: 4,
      container: 'cursor',
    },
  })

  if (container === 'trade') {
    const partnerId = this.tradeManager.getPartnerId(player.unitId)
    if (partnerId !== undefined) {
      this.emitPartnerTradeItemRemove(partnerId, targetItem, prevTargetX, prevTargetY)
      this.emitPartnerTradeItemAdd(partnerId, cursorItem)
    }
    this.emitTradeEvents(
      this.tradeManager.notifyItemRemovedOrSwapped(player.unitId, this.currentFrame),
    )
  }
}



/**
 * 1.13c `C2S 0x27` (`IdentifyItem`, `D2Game.dll` `0x6FCEF6B0`):
 * Consumes 1 loose Scroll of Identify (`'isc'`) or decrements Tome of Identify (`'ibk'`, `quantity > 0`),
 * marks `targetItem.identified = true` (`IFLAG_IDENTIFIED = 0x10`), and syncs full identified item data.
 */
function handleIdentifyItem(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  scrollId: number,
): void {
  if (itemId === scrollId) return
  const targetItem = player.items.find(
    (candidate) =>
      candidate.unitId === itemId &&
      !candidate.identified &&
      candidate.location !== 'ground' &&
      candidate.location !== 'vendor',
  )
  if (!targetItem) return

  const toolIdx = this.findPlayerItemIndex(player, scrollId)
  const toolItem = toolIdx !== -1 ? player.items[toolIdx] : undefined
  if (
    !toolItem ||
    toolItem.location === 'ground' ||
    toolItem.location === 'vendor'
  ) {
    return
  }

  const toolCode = toolItem.code.trim().toLowerCase()
  if (toolCode !== 'isc' && toolCode !== 'ibk') return
  if (toolCode === 'ibk' && (toolItem.quantity ?? 0) <= 0) return

  if (toolCode === 'isc') {
    const wasCursor = toolItem.location === 'cursor'
    const wasBelt = toolItem.location === 'belt'
    const beltPos = wasBelt ? this.getBeltColRow(toolItem) : undefined
    const prevContainer = toItemContainer(toolItem.location)
    const deletedBase = this.serverEntryToItemData(toolItem)
    const deletedFlags = ((deletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    player.items.splice(toolIdx, 1)
    if (wasBelt && beltPos !== undefined) {
      // 1.13c `D2Game.dll` `0x6FCFA0DA` (`cmp ebx, 0x2 -> call 0x6FCF3950`):
      // Belt-carried `'isc'` emits `0x9C` `action = 0x0F` (`RemoveFromBelt`) and shifts upper belt rows down.
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 0x0f,
        itemId: toolItem.unitId,
        code: toolItem.code,
        x: deletedBase.gridX,
        y: 0,
        container: 'belt',
        item: {
          ...deletedBase,
          flags: deletedFlags,
          rawFlags: deletedFlags,
        },
      })
      this.shiftBeltColumnDown(player, beltPos.col, beltPos.row)
    } else {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 0x05,
        itemId: toolItem.unitId,
        code: toolItem.code,
        x: toolItem.x,
        y: toolItem.y,
        container: prevContainer,
        item: {
          ...deletedBase,
          flags: deletedFlags,
          rawFlags: deletedFlags,
        },
      })
    }
    if (wasCursor) {
      this.emitToPlayer(player.unitId, {
        type: 'CursorClear',
        unitType: 'player',
        id: player.unitId,
      })
    }
  } else {
    this.syncServerItemQuantity(toolItem, (toolItem.quantity ?? 0) - 1)
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: toolItem.unitId },
      stat: 70,
      value: toolItem.quantity,
    })
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x15,
      itemId: toolItem.unitId,
      code: toolItem.code,
      x: toolItem.x,
      y: toolItem.y,
      container: toItemContainer(toolItem.location),
      item: this.serverEntryToItemData(toolItem),
    })
  }

  targetItem.identified = true
  if (targetItem.rawItemData !== undefined) {
    const nextFlags = (Number(targetItem.rawItemData.flags ?? 0x10) | 0x10) >>> 0
    const nextRawFlags =
      (Number(targetItem.rawItemData.rawFlags ?? targetItem.rawItemData.flags ?? 0x10) | 0x10) >>> 0
    targetItem.rawItemData = {
      ...targetItem.rawItemData,
      identified: true,
      flags: nextFlags,
      rawFlags: nextRawFlags,
    }
  }
  if (targetItem.location === 'inventory' || targetItem.location === 'equipped') {
    this.refreshPlayerAccruedMaxPools(player)
  }

  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x15,
    itemId: targetItem.unitId,
    code: targetItem.code,
    x: targetItem.x,
    y: targetItem.y,
    container: toItemContainer(targetItem.location),
    item: this.serverEntryToItemData(targetItem),
  })
}



/**
 * 1.13c `C2S 0x29` (`ScrollToBook`, `D2Game.dll` `0x6FCEDB30`, `Misc.txt` `maxstack = 20`):
 * Places cursor loose scroll (`'tsc' -> 'tbk'`, `'isc' -> 'ibk'`) into a tome when `quantity < 20`.
 */
function handleScrollToBook(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  scrollId: number,
  bookId: number,
): void {
  if (scrollId === bookId) return
  const scrollIdx = this.findPlayerItemIndex(player, scrollId)
  const scrollItem = scrollIdx !== -1 ? player.items[scrollIdx] : undefined
  if (!scrollItem || scrollItem.location !== 'cursor') return

  const bookItem = player.items.find(
    (candidate) =>
      candidate.unitId === bookId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube'),
  )
  if (!bookItem) return

  const scrollCode = scrollItem.code.trim().toLowerCase()
  const bookCode = bookItem.code.trim().toLowerCase()
  const validPair =
    (scrollCode === 'tsc' && bookCode === 'tbk') ||
    (scrollCode === 'isc' && bookCode === 'ibk')
  if (!validPair) return

  const currentQty = Math.max(0, Math.trunc(bookItem.quantity ?? 0))
  if (currentQty >= 20) return

  const deletedBase = this.serverEntryToItemData(scrollItem)
  const deletedFlags = ((deletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
  player.items.splice(scrollIdx, 1)

  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x05,
    itemId: scrollItem.unitId,
    code: scrollItem.code,
    x: 0,
    y: 0,
    container: 'cursor',
    item: {
      ...deletedBase,
      flags: deletedFlags,
      rawFlags: deletedFlags,
    },
  })
  this.emitToPlayer(player.unitId, {
    type: 'CursorClear',
    unitType: 'player',
    id: player.unitId,
  })

  this.syncServerItemQuantity(bookItem, currentQty + 1)
  this.emitToPlayer(player.unitId, {
    type: 'StatSet',
    unit: { unitType: 4, id: bookItem.unitId },
    stat: 70,
    value: bookItem.quantity,
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x15,
    itemId: bookItem.unitId,
    code: bookItem.code,
    x: bookItem.x,
    y: bookItem.y,
    container: toItemContainer(bookItem.location),
    item: this.serverEntryToItemData(bookItem),
  })
}



function handleBeltSwap(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cursorItemId: number,
  beltItemId: number,
): void {
  if (cursorItemId === beltItemId) return
  const cursorItem = player.items.find(
    (candidate) =>
      candidate.unitId === cursorItemId &&
      candidate.location === 'cursor' &&
      candidate.width === 1 &&
      candidate.height === 1 &&
      BELT_POTION_CATALOG[candidate.code.trim().toLowerCase()] !== undefined,
  )
  const beltItem = player.items.find(
    (candidate) => candidate.unitId === beltItemId && candidate.location === 'belt',
  )
  if (!cursorItem || !beltItem) return
  const { col, row } = this.getBeltColRow(beltItem)
  const linearSlot = this.setBeltEntryColRow(cursorItem, col, row)

  beltItem.location = 'cursor'
  beltItem.x = 0
  beltItem.y = 0
  beltItem.storePage = 0
  if (beltItem.rawItemData !== undefined) {
    const cleanFlags = Number(beltItem.rawItemData.rawFlags ?? beltItem.rawItemData.flags ?? 0x10) & ~0x20
    beltItem.rawItemData = {
      ...beltItem.rawItemData,
      location: 4,
      container: 'cursor',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      storePage: 0,
      storagePage: 0,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }

  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x10,
    itemId: cursorItem.unitId,
    code: cursorItem.code,
    x: linearSlot,
    y: 0,
    container: 'belt',
    item: this.serverEntryToItemData(cursorItem),
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x0f,
    itemId: beltItem.unitId,
    code: beltItem.code,
    x: 0,
    y: 0,
    container: 'cursor',
    item: {
      ...this.serverEntryToItemData(beltItem),
      location: 4,
      container: 'cursor',
    },
  })
}



function handleItemToBelt(this: GameInstanceHost, player: InternalPlayerRecord, itemId: number): void {
  const item = player.items.find(
    (candidate) =>
      candidate.unitId === itemId &&
      candidate.location === 'inventory' &&
      candidate.width === 1 &&
      candidate.height === 1,
  )
  if (!item) return
  const lowerCode = item.code.trim().toLowerCase()
  if (BELT_POTION_CATALOG[lowerCode] === undefined) return
  const slot = this.findAvailableBeltSlot(player, lowerCode)
  if (!slot) return
  this.handleBeltPut(player, itemId, (slot.y * 4 + slot.x) & 0x0f)
}



/**
 * 1.13c `C2S 0x21` (`StackItems`, `D2Game.dll` `0x6FCEE4B0`):
 * Merges stackable same-code normal items (`key`, `aqv`, `cqv`, throwing weapons) from cursor
 * into an unfilled container stack up to `Misc.txt` / `Weapons.txt` `maxstack`.
 */
function handleStackItems(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cursorItemId: number,
  targetItemId: number,
): void {
  if (cursorItemId === targetItemId) return
  const cursorIdx = this.findPlayerItemIndex(player, cursorItemId)
  const cursorItem = cursorIdx !== -1 ? player.items[cursorIdx] : undefined
  if (!cursorItem || cursorItem.location !== 'cursor') return

  const targetItem = player.items.find(
    (candidate) =>
      candidate.unitId === targetItemId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube'),
  )
  if (!targetItem) return

  const code = cursorItem.code.trim().toLowerCase()
  if (code !== targetItem.code.trim().toLowerCase()) return
  if (code === 'tbk' || code === 'ibk') return

  const info = lookupBaseInfo(cursorItem.code.trim())
  const fallbackMax =
    code === 'key' ? 12 : code === 'aqv' ? 350 : code === 'cqv' ? 250 : 0
  const maxStack = info.maxStack > 0 ? info.maxStack : fallbackMax
  if ((!info.stackable && maxStack <= 0) || maxStack <= 1) return

  // D2Game 0x6FCEE4B0 only merges normal/non-magic stackables without sockets or runewords.
  if (
    cursorItem.quality > 3 ||
    targetItem.quality > 3 ||
    cursorItem.socketed ||
    targetItem.socketed ||
    Boolean(cursorItem.rawItemData?.runeword) ||
    Boolean(targetItem.rawItemData?.runeword)
  ) {
    return
  }

  const cursorQty = Math.max(1, Math.trunc(cursorItem.quantity || 1))
  const targetQty = Math.max(1, Math.trunc(targetItem.quantity || 1))
  if (targetQty >= maxStack) return

  const transfer = Math.min(cursorQty, maxStack - targetQty)
  if (transfer <= 0) return

  const nextTargetQty = targetQty + transfer
  const nextCursorQty = cursorQty - transfer

  this.syncServerItemQuantity(targetItem, nextTargetQty)
  this.emitToPlayer(player.unitId, {
    type: 'StatSet',
    unit: { unitType: 4, id: targetItem.unitId },
    stat: 70,
    value: targetItem.quantity,
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x15,
    itemId: targetItem.unitId,
    code: targetItem.code,
    x: targetItem.x,
    y: targetItem.y,
    container: toItemContainer(targetItem.location),
    item: this.serverEntryToItemData(targetItem),
  })

  if (nextCursorQty <= 0) {
    const deletedBase = this.serverEntryToItemData(cursorItem)
    const deletedFlags = ((deletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    player.items.splice(cursorIdx, 1)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x05,
      itemId: cursorItem.unitId,
      code: cursorItem.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: {
        ...deletedBase,
        flags: deletedFlags,
        rawFlags: deletedFlags,
      },
    })
    this.emitToPlayer(player.unitId, {
      type: 'CursorClear',
      unitType: 'player',
      id: player.unitId,
    })
  } else {
    this.syncServerItemQuantity(cursorItem, nextCursorQty)
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: cursorItem.unitId },
      stat: 70,
      value: cursorItem.quantity,
    })
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x15,
      itemId: cursorItem.unitId,
      code: cursorItem.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: {
        ...this.serverEntryToItemData(cursorItem),
        location: 4,
        container: 'cursor',
      },
    })
  }
}



/**
 * 1.13c `C2S 0x22` (`UnstackItems`, `D2Game.dll` `0x6FCED4F0`):
 * Extracts 1 scroll onto an empty cursor from a Tome (`'tbk' -> 'tsc'`, `'ibk' -> 'isc'`),
 * or splits a normal stackable item (`quantity > 1`) onto an empty cursor.
 */
function handleUnstackItems(this: GameInstanceHost, player: InternalPlayerRecord, itemId: number): void {
  if (player.items.some((candidate) => candidate.location === 'cursor')) return
  const source = player.items.find(
    (candidate) =>
      candidate.unitId === itemId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube'),
  )
  if (!source) return

  const code = source.code.trim().toLowerCase()
  if (code === 'tbk' || code === 'ibk') {
    const curQty = Math.max(0, Math.trunc(source.quantity ?? 0))
    if (curQty <= 0) return
    const scrollCode = code === 'tbk' ? 'tsc' : 'isc'
    const scrollInfo = lookupBaseInfo(scrollCode)
    this.syncServerItemQuantity(source, curQty - 1)
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: source.unitId },
      stat: 70,
      value: source.quantity,
    })
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x15,
      itemId: source.unitId,
      code: source.code,
      x: source.x,
      y: source.y,
      container: toItemContainer(source.location),
      item: this.serverEntryToItemData(source),
    })

    const spawnedScroll: ServerItemEntry = {
      unitId: this.allocateUnitId(UNIT_TYPE_113C.item),
      code: scrollCode,
      name: scrollInfo.name,
      quality: 2,
      level: source.level || player.level,
      location: 'cursor',
      x: 0,
      y: 0,
      width: scrollInfo.width,
      height: scrollInfo.height,
      areaId: player.areaId,
      ownerId: player.unitId,
      bodyLoc: 0,
      storePage: 0,
      cost: scrollInfo.cost,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }
    player.items.push(spawnedScroll)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x05,
      itemId: spawnedScroll.unitId,
      code: spawnedScroll.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: {
        ...this.serverEntryToItemData(spawnedScroll),
        location: 4,
        container: 'cursor',
      },
    })
    return
  }

  const info = lookupBaseInfo(source.code.trim())
  const fallbackMax =
    code === 'key' ? 12 : code === 'aqv' ? 350 : code === 'cqv' ? 250 : 0
  if (!info.stackable && fallbackMax <= 1) return
  if (
    source.quality > 3 ||
    source.socketed ||
    Boolean(source.rawItemData?.runeword)
  ) {
    return
  }

  const curQty = Math.max(1, Math.trunc(source.quantity || 1))
  if (curQty <= 1) return
  const splitQty = Math.max(1, Math.floor(curQty / 2))
  const remainQty = curQty - splitQty

  this.syncServerItemQuantity(source, remainQty)
  this.emitToPlayer(player.unitId, {
    type: 'StatSet',
    unit: { unitType: 4, id: source.unitId },
    stat: 70,
    value: source.quantity,
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x15,
    itemId: source.unitId,
    code: source.code,
    x: source.x,
    y: source.y,
    container: toItemContainer(source.location),
    item: this.serverEntryToItemData(source),
  })

  const splitStats = new Map<number, number>(source.stats)
  splitStats.set(70, splitQty)
  const splitItem: ServerItemEntry = {
    unitId: this.allocateUnitId(UNIT_TYPE_113C.item),
    code: source.code.trim(),
    name: source.name,
    quality: source.quality,
    level: source.level,
    location: 'cursor',
    x: 0,
    y: 0,
    width: source.width,
    height: source.height,
    areaId: player.areaId,
    ownerId: player.unitId,
    bodyLoc: 0,
    storePage: 0,
    cost: source.cost,
    gamble: false,
    identified: source.identified,
    ethereal: source.ethereal,
    socketed: false,
    totalSockets: 0,
    durability: source.durability,
    maxDurability: source.maxDurability,
    quantity: splitQty,
    stats: splitStats,
    socketedItems: [],
  }
  this.syncServerItemQuantity(splitItem, splitQty)
  player.items.push(splitItem)
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x05,
    itemId: splitItem.unitId,
    code: splitItem.code,
    x: 0,
    y: 0,
    container: 'cursor',
    item: {
      ...this.serverEntryToItemData(splitItem),
      location: 4,
      container: 'cursor',
    },
  })
}



/**
 * 1.13c `C2S 0x3E` (`SelectMainItem` / `ActivateQuestScroll`, `D2Game.dll` `0x6FCED8D0`):
 * Opens the deciphered Scroll of Inifuss (`'bkd'`) Cairn Stones order overlay via `S2C 0x7C`
 * (`UseSpecialItem`), or consumes quest scrolls/books (`'tr2'`, `'ass'`, `'xyz'`).
 */
function handleSelectMainItem(this: GameInstanceHost, player: InternalPlayerRecord, itemId: number): void {
  const item = player.items.find(
    (candidate) =>
      candidate.unitId === itemId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube' ||
        candidate.location === 'belt'),
  )
  if (!item) return
  const code = item.code.trim().toLowerCase()
  if (code === 'bkd') {
    const words = new Uint16Array(7)
    words[0] = 4
    for (let i = 0; i < 5; i++) {
      const stoneClassId = this.cairnStoneOrder[i] ?? 17 + i
      words[1 + i] = Math.max(0, Math.min(4, stoneClassId - 17))
    }
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'item',
      source: 0x50,
      quests: words,
      flags: Array.from(words),
    })
    this.emitToPlayer(player.unitId, {
      type: 'UseSpecialItem',
      unitType: 4,
      id: item.unitId,
    })
    return
  }
  if (code === 'tr2' || code === 'ass' || code === 'xyz') {
    this.handleBeltUse(player, item.unitId, false)
  }
}



function handleItemToCube(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  itemId: number,
  cubeId: number,
): void {
  const item = player.items.find(
    (candidate) => candidate.unitId === itemId && candidate.location === 'cursor',
  )
  const cube = player.items.find(
    (candidate) =>
      candidate.unitId === cubeId &&
      candidate.code.trim().toLowerCase() === 'box' &&
      (candidate.location === 'inventory' || candidate.location === 'stash'),
  )
  if (!item || !cube) return
  if (item.unitId === cube.unitId || item.code.trim().toLowerCase() === 'box') return
  const free = this.findFreeGridSlot(player, 'cube', item.width, item.height, 3, 4)
  if (!free) return
  this.handleItemMove(player, item.unitId, free.x, free.y, 'cube')
}



function handleDropGold(this: GameInstanceHost, player: InternalPlayerRecord, rawAmount: number): void {
  const amount = Math.trunc(rawAmount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > player.gold) return
  player.gold -= amount
  for (const ev of [
    {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 14,
      value: player.gold,
    },
    {
      type: 'StatSet',
      stat: 14,
      value: player.gold,
    },
  ] as const) {
    this.emitToPlayer(player.unitId, ev)
  }
  this.dropPlayerGoldPile(player, amount)
}

export interface PlayerInventoryMethods {
  handleItemPickup(player: InternalPlayerRecord, itemId: number, toCursor: boolean, allowRanged?: boolean | undefined): void
  findPlayerItemIndex(player: InternalPlayerRecord, itemId: number): number
  handleItemDrop(player: InternalPlayerRecord, itemId: number): void
  handleItemMove(player: InternalPlayerRecord, itemId: number, x: number, y: number, container: 'inventory' | 'stash' | 'cube' | 'belt' | 'trade'): void
  handleItemEquip(player: InternalPlayerRecord, itemId: number, slot: number, removeOppositeHand?: boolean | undefined): void
  handleItemUnequip(player: InternalPlayerRecord, slot: number): void
  handleSwapWeapons(player: InternalPlayerRecord): void
  resolveMercDefaultBodyLoc113c(code: string, act: 1 | 2 | 3 | 5): number | undefined
  handleMercItem(player: InternalPlayerRecord, rawSlot: number): void
  getPlayerBeltMaxRows(player: InternalPlayerRecord): number
  getBeltColRow(it: ServerItemEntry): { col: number; row: number }
  setBeltEntryColRow(it: ServerItemEntry, col: number, row: number): number
  shiftBeltColumnDown(player: InternalPlayerRecord, col: number, removedRow: number): void
  handleBeltPut(player: InternalPlayerRecord, itemId: number, slot: number): void
  handleBeltRemoveToCursor(player: InternalPlayerRecord, itemId: number): void
  handleBeltUse(player: InternalPlayerRecord, itemId: number, useOnMerc?: boolean | undefined): void
  findFreeGridSlot(player: InternalPlayerRecord, container: 'inventory' | 'stash' | 'cube', w: number, h: number, gridW: number, gridH: number): { x: number; y: number } | undefined
  handleItemToCursor(player: InternalPlayerRecord, itemId: number): void
  syncServerItemQuantity(entry: ServerItemEntry, nextQty: number): void
  handleSwapContainerItem(player: InternalPlayerRecord, cursorItemId: number, targetItemId: number, x: number, y: number): void
  handleIdentifyItem(player: InternalPlayerRecord, itemId: number, scrollId: number): void
  handleScrollToBook(player: InternalPlayerRecord, scrollId: number, bookId: number): void
  handleBeltSwap(player: InternalPlayerRecord, cursorItemId: number, beltItemId: number): void
  handleItemToBelt(player: InternalPlayerRecord, itemId: number): void
  handleStackItems(player: InternalPlayerRecord, cursorItemId: number, targetItemId: number): void
  handleUnstackItems(player: InternalPlayerRecord, itemId: number): void
  handleSelectMainItem(player: InternalPlayerRecord, itemId: number): void
  handleItemToCube(player: InternalPlayerRecord, itemId: number, cubeId: number): void
  handleDropGold(player: InternalPlayerRecord, rawAmount: number): void
}

export const playerInventoryMethods: Record<keyof PlayerInventoryMethods, unknown> = {
  handleItemPickup,
  findPlayerItemIndex,
  handleItemDrop,
  handleItemMove,
  handleItemEquip,
  handleItemUnequip,
  handleSwapWeapons,
  resolveMercDefaultBodyLoc113c,
  handleMercItem,
  getPlayerBeltMaxRows,
  getBeltColRow,
  setBeltEntryColRow,
  shiftBeltColumnDown,
  handleBeltPut,
  handleBeltRemoveToCursor,
  handleBeltUse,
  findFreeGridSlot,
  handleItemToCursor,
  syncServerItemQuantity,
  handleSwapContainerItem,
  handleIdentifyItem,
  handleScrollToBook,
  handleBeltSwap,
  handleItemToBelt,
  handleStackItems,
  handleUnstackItems,
  handleSelectMainItem,
  handleItemToCube,
  handleDropGold,
}
