import type { WorldPanelsHud } from '../world-panels.ts'
import { TOME_MAX_QUANTITY, applySocketToUiItem, canSocketUiItem, getTomeQuantity, isScrollForTome, setTomeQuantity, type GridPlacement, type InventoryPanel, type UiInventoryItem } from '../inventory.ts'
import type { Item } from '../../../common/items/items.ts'
import type { TownNpcServiceDescriptor } from '../../../common/units/npc-table.ts'
import type { VendorTabId } from '../../../common/items/vendor-generator.ts'
import { transmuteCubeItems, type CubeTransmuteResult } from '../../../common/items/runeword-socket.ts'
import { STASH_GRID_ORIGIN, CUBE_GRID_ORIGIN, CUBE_TRANSMUTE_BTN_BOUNDS, CUBE_CLOSE_BTN_BOUNDS, VENDOR_PANEL_ORIGIN, VENDOR_BUTTON_TABLE_X, VENDOR_BUTTON_HIT_Y_MIN, VENDOR_BUTTON_HIT_Y_MAX, VENDOR_BUTTON_HIT_W, type VendorButtonKind, VENDOR_BUTTON_SPECS, resolveVendorButtonLayout, VENDOR_TABS } from './panel-layout-constants.ts'

/**
 * D2Client.dll `0x6fb3b600` (Transmute button) & `0x6fb3b650` (Cube Close button):
 * - Transmute: `relX ∈ [144, 184]`, `relY ∈ [257, 297]` (`x ∈ [224, 264]`, `y ∈ [317, 357]`)
 * - Close: `relX ∈ [275, 315]`, `relY ∈ [380, 420]` (`x ∈ [355, 395]`, `y ∈ [440, 480]`)
 */
export function hitTestCubeButtonImpl(this: WorldPanelsHud, logicalX: number, logicalY: number): 'transmute' | 'close' | null {
  if (
    logicalX >= CUBE_TRANSMUTE_BTN_BOUNDS.hitMinX &&
    logicalX <= CUBE_TRANSMUTE_BTN_BOUNDS.hitMaxX &&
    logicalY >= CUBE_TRANSMUTE_BTN_BOUNDS.hitMinY &&
    logicalY <= CUBE_TRANSMUTE_BTN_BOUNDS.hitMaxY
  ) {
    return 'transmute'
  }
  if (
    logicalX >= CUBE_CLOSE_BTN_BOUNDS.hitMinX &&
    logicalX <= CUBE_CLOSE_BTN_BOUNDS.hitMaxX &&
    logicalY >= CUBE_CLOSE_BTN_BOUNDS.hitMinY &&
    logicalY <= CUBE_CLOSE_BTN_BOUNDS.hitMaxY
  ) {
    return 'close'
  }
  return null
}
/**
 * D2Client.dll `0x6fb3f710` (`0x6fb3f7a1–0x6fb3f873`):
 * If requested tab is empty, cycle forward `(idx + 1) % 4` up to 4 tries to find a non-empty tab.
 */
export function selectVendorTabImpl(this: WorldPanelsHud, requestedTab: VendorTabId): void {
  if (this.vendorMode === 'gamble') {
    this.activeVendorTab = 'armor'
    return
  }
  const startIdx = VENDOR_TABS.findIndex(t => t.id === requestedTab)
  if (startIdx === -1) {
    throw new Error(`Invalid vendor tab: ${requestedTab}`)
  }
  for (let step = 0; step < 4; step++) {
    const idx = (startIdx + step) % 4
    const candidate = VENDOR_TABS[idx]!
    if (this.vendorTabPlacements[candidate.id].length > 0) {
      this.activeVendorTab = candidate.id
      return
    }
  }
  this.activeVendorTab = VENDOR_TABS[startIdx]!.id
}
/**
 * D2Client.dll `0x6fb4c27a` (mousedown) & `0x6fb3f260` (hover):
 * Open intervals `relX ∈ (tableX, tableX + 45)`, `relY ∈ (371, 415)`, enabled slots only.
 */
export function hitTestVendorButtonSlotImpl(this: WorldPanelsHud, logicalX: number, logicalY: number): 0 | 1 | 2 | 3 | null {
  if (!this.activeVendorDescriptor) return null
  const relX = logicalX - VENDOR_PANEL_ORIGIN.x
  const relY = logicalY - VENDOR_PANEL_ORIGIN.y
  if (relY <= VENDOR_BUTTON_HIT_Y_MIN || relY >= VENDOR_BUTTON_HIT_Y_MAX) return null
  const layout = resolveVendorButtonLayout(this.activeVendorDescriptor.hcIdx, this.vendorMode)
  for (let slot = 0 as 0 | 1 | 2 | 3; slot < 4; slot = (slot + 1) as 0 | 1 | 2 | 3) {
    const kind = layout[slot]!
    const spec = VENDOR_BUTTON_SPECS[kind]
    if (!spec.enabled) continue
    const tableX = VENDOR_BUTTON_TABLE_X[slot]!
    if (relX > tableX && relX < tableX + VENDOR_BUTTON_HIT_W) {
      return slot
    }
  }
  return null
}
export function getVendorButtonFrameImpl(
  this: WorldPanelsHud,
  slot: 0 | 1 | 2 | 3,
  layout?: readonly [VendorButtonKind, VendorButtonKind, VendorButtonKind, VendorButtonKind],
): number {
  if (!layout && !this.activeVendorDescriptor) {
    throw new Error('Cannot resolve vendor button frame without active vendor descriptor')
  }
  const resolvedLayout =
    layout ?? resolveVendorButtonLayout(this.activeVendorDescriptor!.hcIdx, this.vendorMode)
  const kind = resolvedLayout[slot]!
  const spec = VENDOR_BUTTON_SPECS[kind]
  if (!spec.enabled) return spec.baseFrame
  const isPressed =
    kind === 'buy' || kind === 'sell' || kind === 'repair'
      ? this.vendorTradeState === kind
      : this.pressedMomentarySlot === slot
  return isPressed ? spec.pressedFrame : spec.baseFrame
}
/**
 * Show the store the server filled with `0x9C AddToShop` items (`ClientWorld.containers.shop`).
 * `pages`: one entry per shop item with its bitstream `storePage` (1..4 -> tab index 0..3, D2Client
 * 0x6fb91178 tab table). Re-applying the same store keeps the selected tab unless it became empty
 * (D2Client 0x6fb3f710 advances to the next non-empty tab).
 */
export function setVendorShopImpl(this: WorldPanelsHud, p: {
  readonly npcId: number
  readonly descriptor: TownNpcServiceDescriptor
  readonly mode: 'trade' | 'gamble'
  readonly items: readonly { readonly storePage: number; readonly placement: GridPlacement }[]
}): void {
  // Fail fast against the D2Client.dll 0x6fb3f430 button layout table.
  resolveVendorButtonLayout(p.descriptor.hcIdx, p.mode)
  const sameStore =
    this.vendorNpcId === p.npcId &&
    this.vendorMode === p.mode &&
    this.activeVendorDescriptor?.hcIdx === p.descriptor.hcIdx
  if (!sameStore) {
    this.vendorTradeState = 'idle'
    this.hoveredVendorButtonSlot = null
    this.pressedMomentarySlot = null
    this.hoveredVendorItem = null
  }
  this.activeVendorDescriptor = p.descriptor
  this.vendorNpcId = p.npcId
  this.vendorMode = p.mode
  const tabs: Record<VendorTabId, GridPlacement[]> = { armor: [], weapons1: [], weapons2: [], misc: [] }
  const gamble: GridPlacement[] = []
  for (const entry of p.items) {
    if (p.mode === 'gamble') {
      gamble.push(entry.placement)
      continue
    }
    const tab = VENDOR_TABS[entry.storePage - 1]
    if (!tab) throw new Error(`setVendorShop: shop item store page ${entry.storePage} is outside 1..4`)
    tabs[tab.id].push(entry.placement)
  }
  this.vendorTabPlacements = tabs
  this.gamblePlacements = gamble
  if (p.mode === 'gamble') {
    this.activeVendorTab = 'armor'
  } else if (!sameStore) {
    // D2Client.dll 0x6fb411a0 -> 0x6fb3f710(0): start at tab 0 and cycle to the first non-empty tab.
    this.selectVendorTab('armor')
  } else if (this.vendorTabPlacements[this.activeVendorTab].length === 0) {
    this.selectVendorTab(this.activeVendorTab)
  }
  if (this.hoveredVendorItem) {
    const matched = this.getActiveVendorPlacements().find(pl => pl.item.id === this.hoveredVendorItem!.item.id)
    if (matched) {
      this.hoveredVendorItem = { ...this.hoveredVendorItem, item: matched.item }
    } else {
      this.hoveredVendorItem = null
    }
  }
}
export function clearVendorShopImpl(this: WorldPanelsHud): void {
  this.activeVendorDescriptor = null
  this.vendorNpcId = null
  this.vendorMode = 'trade'
  this.vendorTradeState = 'idle'
  this.vendorRepairAllCost = null
  this.hoveredVendorButtonSlot = null
  this.pressedMomentarySlot = null
  this.hoveredVendorItem = null
  this.vendorTabPlacements = { armor: [], weapons1: [], weapons2: [], misc: [] }
  this.gamblePlacements = []
  this.activeVendorTab = 'armor'
}
/**
 * Check whether an item of (w, h) can be placed at (col, row) in the 6x8 stash grid.
 * Throws RangeError if placed out of bounds. Returns all overlapping GridPlacements.
 */
export function getStashOverlapsImpl(this: WorldPanelsHud, col: number, row: number, w: number, h: number): GridPlacement[] {
  if (col < 0 || row < 0 || col + w > STASH_GRID_ORIGIN.cols || row + h > STASH_GRID_ORIGIN.rows) {
    throw new RangeError('Out of 6x8 stash grid bounds')
  }
  return this.stashItems.filter(p => {
    const ox = col < p.col + p.item.invWidth && col + w > p.col
    const oy = row < p.row + p.item.invHeight && row + h > p.row
    return ox && oy
  })
}
export function canPlaceInStashImpl(this: WorldPanelsHud, col: number, row: number, w: number, h: number): boolean {
  if (col < 0 || row < 0 || col + w > STASH_GRID_ORIGIN.cols || row + h > STASH_GRID_ORIGIN.rows) {
    return false
  }
  return this.getStashOverlaps(col, row, w, h).length === 0
}
export function autoPlaceInStashImpl(this: WorldPanelsHud, rawItem: UiInventoryItem | Item): boolean {
  const item = rawItem as UiInventoryItem
  for (let col = 0; col <= STASH_GRID_ORIGIN.cols - item.invWidth; col++) {
    for (let row = 0; row <= STASH_GRID_ORIGIN.rows - item.invHeight; row++) {
      if (this.canPlaceInStash(col, row, item.invWidth, item.invHeight)) {
        this.stashItems.push({ item, col, row })
        return true
      }
    }
  }
  return false
}
export function clickStashCellImpl(
  this: WorldPanelsHud,
  col: number,
  row: number,
  rawCursorItem: UiInventoryItem | Item | null,
): { handled: boolean; newCursorItem: UiInventoryItem | null; cursorItem: UiInventoryItem | null } {
  const makeRes = (handled: boolean, newCursorItem: UiInventoryItem | null) => {
    const res: any = { handled, newCursorItem }
    Object.defineProperty(res, 'cursorItem', { value: newCursorItem, enumerable: false })
    return res as { handled: boolean; newCursorItem: UiInventoryItem | null; cursorItem: UiInventoryItem | null }
  }
  const cursorItem = rawCursorItem as UiInventoryItem | null
  if (!cursorItem) {
    const hit = this.stashItems.find(
      p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    if (!hit) return makeRes(false, null)
    this.stashItems = this.stashItems.filter(p => p !== hit)
    return makeRes(true, hit.item)
  }

  const directHit = this.stashItems.find(
    p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
  )
  if (directHit && isScrollForTome(cursorItem.code, directHit.item.code)) {
    const curQty = getTomeQuantity(directHit.item)
    const maxQty = directHit.item.maxQuantity ?? TOME_MAX_QUANTITY
    if (curQty < maxQty) {
      const scrollQty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
      const addQty = Math.min(maxQty - curQty, scrollQty)
      setTomeQuantity(directHit.item, curQty + addQty)
      if (scrollQty > addQty) {
        setTomeQuantity(cursorItem, scrollQty - addQty)
        return makeRes(true, cursorItem)
      }
      return makeRes(true, null)
    }
  }
  if (directHit && canSocketUiItem(cursorItem, directHit.item)) {
    applySocketToUiItem(directHit.item, cursorItem)
    const qty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
    if (qty > 1) {
      setTomeQuantity(cursorItem, qty - 1)
      return makeRes(true, cursorItem)
    }
    return makeRes(true, null)
  }

  if (
    col < 0 ||
    row < 0 ||
    col + cursorItem.invWidth > STASH_GRID_ORIGIN.cols ||
    row + cursorItem.invHeight > STASH_GRID_ORIGIN.rows
  ) {
    return makeRes(false, cursorItem)
  }

  const overlaps = this.getStashOverlaps(col, row, cursorItem.invWidth, cursorItem.invHeight)
  if (overlaps.length === 0) {
    this.stashItems.push({ item: cursorItem, col, row })
    return makeRes(true, null)
  }
  if (overlaps.length === 1) {
    const single = overlaps[0]!
    if (isScrollForTome(cursorItem.code, single.item.code)) {
      const curQty = getTomeQuantity(single.item)
      const maxQty = single.item.maxQuantity ?? TOME_MAX_QUANTITY
      if (curQty < maxQty) {
        const scrollQty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
        const addQty = Math.min(maxQty - curQty, scrollQty)
        setTomeQuantity(single.item, curQty + addQty)
        if (scrollQty > addQty) {
          setTomeQuantity(cursorItem, scrollQty - addQty)
          return makeRes(true, cursorItem)
        }
        return makeRes(true, null)
      }
    }
    if (canSocketUiItem(cursorItem, single.item)) {
      applySocketToUiItem(single.item, cursorItem)
      const qty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
      if (qty > 1) {
        setTomeQuantity(cursorItem, qty - 1)
        return makeRes(true, cursorItem)
      }
      return makeRes(true, null)
    }
    this.stashItems = this.stashItems.filter(p => p !== single)
    this.stashItems.push({ item: cursorItem, col, row })
    return makeRes(true, single.item)
  }
  return makeRes(false, cursorItem)
}
export function quickTransferToStashImpl(this: WorldPanelsHud, rawItem: UiInventoryItem | Item, fromInventory: InventoryPanel): boolean {
  const hitIdx = fromInventory.gridItems.findIndex(
    p => p.item === rawItem || (rawItem.id !== undefined && p.item.id === String(rawItem.id)),
  )
  if (hitIdx === -1) return false
  const item = fromInventory.gridItems[hitIdx]!.item
  if (!this.autoPlaceInStash(item)) return false
  fromInventory.gridItems.splice(hitIdx, 1)
  return true
}
export function quickTransferFromStashImpl(this: WorldPanelsHud, rawItem: UiInventoryItem | Item, toInventory: InventoryPanel): boolean {
  const hitIdx = this.stashItems.findIndex(
    p => p.item === rawItem || (rawItem.id !== undefined && p.item.id === String(rawItem.id)),
  )
  if (hitIdx === -1) return false
  const item = this.stashItems[hitIdx]!.item
  if (!toInventory.autoPlaceInGrid(item)) return false
  this.stashItems.splice(hitIdx, 1)
  return true
}
/**
 * Check whether an item of (w, h) can be placed at (col, row) in the 3x4 Horadric Cube grid.
 */
export function getCubeOverlapsImpl(this: WorldPanelsHud, col: number, row: number, w: number, h: number): GridPlacement[] {
  if (col < 0 || row < 0 || col + w > CUBE_GRID_ORIGIN.cols || row + h > CUBE_GRID_ORIGIN.rows) {
    throw new RangeError('Out of 3x4 Horadric Cube grid bounds')
  }
  return this.cubeItems.filter(p => {
    const ox = col < p.col + p.item.invWidth && col + w > p.col
    const oy = row < p.row + p.item.invHeight && row + h > p.row
    return ox && oy
  })
}
export function canPlaceInCubeImpl(this: WorldPanelsHud, col: number, row: number, w: number, h: number): boolean {
  if (col < 0 || row < 0 || col + w > CUBE_GRID_ORIGIN.cols || row + h > CUBE_GRID_ORIGIN.rows) {
    return false
  }
  return this.getCubeOverlaps(col, row, w, h).length === 0
}
/**
 * Ground Truth (`D2Client.dll` `0x6fb470b3..0x6fb47154` & `D2Common.dll` `D2Inventory.cpp:961`):
 * Returns `true` when `item` is not the Horadric Cube (`box`) and at least one free `(col, row)`
 * cell in the `3x4` Cube grid can accommodate `(invWidth, invHeight)`.
 */
export function canFitInCubeImpl(this: WorldPanelsHud, item: Pick<UiInventoryItem, 'invWidth' | 'invHeight' | 'code'>): boolean {
  const code = (item.code ?? '').trim().toLowerCase()
  if (code === 'box' || code === 'cube') return false
  const w = Math.max(1, Math.trunc(item.invWidth || 1))
  const h = Math.max(1, Math.trunc(item.invHeight || 1))
  for (let col = 0; col <= CUBE_GRID_ORIGIN.cols - w; col++) {
    for (let row = 0; row <= CUBE_GRID_ORIGIN.rows - h; row++) {
      if (this.canPlaceInCube(col, row, w, h)) return true
    }
  }
  return false
}
export function autoPlaceInCubeImpl(this: WorldPanelsHud, item: UiInventoryItem): boolean {
  const code = (item.code ?? '').trim().toLowerCase()
  if (code === 'box' || code === 'cube') return false
  for (let col = 0; col <= CUBE_GRID_ORIGIN.cols - item.invWidth; col++) {
    for (let row = 0; row <= CUBE_GRID_ORIGIN.rows - item.invHeight; row++) {
      if (this.canPlaceInCube(col, row, item.invWidth, item.invHeight)) {
        this.cubeItems.push({ item, col, row })
        return true
      }
    }
  }
  return false
}
export function clickCubeCellImpl(
  this: WorldPanelsHud,
  col: number,
  row: number,
  cursorItem: UiInventoryItem | null,
): { handled: boolean; newCursorItem: UiInventoryItem | null } {
  if (!cursorItem) {
    const hit = this.cubeItems.find(
      p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    if (!hit) return { handled: false, newCursorItem: null }
    this.cubeItems = this.cubeItems.filter(p => p !== hit)
    return { handled: true, newCursorItem: hit.item }
  }

  const code = (cursorItem.code ?? '').trim().toLowerCase()
  if (code === 'box' || code === 'cube') {
    return { handled: false, newCursorItem: cursorItem }
  }

  const directHit = this.cubeItems.find(
    p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
  )
  if (directHit && isScrollForTome(cursorItem.code, directHit.item.code)) {
    const curQty = getTomeQuantity(directHit.item)
    const maxQty = directHit.item.maxQuantity ?? TOME_MAX_QUANTITY
    if (curQty < maxQty) {
      const scrollQty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
      const addQty = Math.min(maxQty - curQty, scrollQty)
      setTomeQuantity(directHit.item, curQty + addQty)
      if (scrollQty > addQty) {
        setTomeQuantity(cursorItem, scrollQty - addQty)
        return { handled: true, newCursorItem: cursorItem }
      }
      return { handled: true, newCursorItem: null }
    }
  }
  if (directHit && canSocketUiItem(cursorItem, directHit.item)) {
    applySocketToUiItem(directHit.item, cursorItem)
    const qty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
    if (qty > 1) {
      setTomeQuantity(cursorItem, qty - 1)
      return { handled: true, newCursorItem: cursorItem }
    }
    return { handled: true, newCursorItem: null }
  }

  const targetCol = Math.min(CUBE_GRID_ORIGIN.cols - cursorItem.invWidth, Math.max(0, col))
  const targetRow = Math.min(CUBE_GRID_ORIGIN.rows - cursorItem.invHeight, Math.max(0, row))
  if (
    targetCol < 0 ||
    targetRow < 0 ||
    targetCol + cursorItem.invWidth > CUBE_GRID_ORIGIN.cols ||
    targetRow + cursorItem.invHeight > CUBE_GRID_ORIGIN.rows
  ) {
    return { handled: false, newCursorItem: cursorItem }
  }

  const overlaps = this.getCubeOverlaps(targetCol, targetRow, cursorItem.invWidth, cursorItem.invHeight)
  if (overlaps.length === 0) {
    this.cubeItems.push({ item: cursorItem, col: targetCol, row: targetRow })
    return { handled: true, newCursorItem: null }
  }
  if (overlaps.length === 1) {
    const single = overlaps[0]!
    if (isScrollForTome(cursorItem.code, single.item.code)) {
      const curQty = getTomeQuantity(single.item)
      const maxQty = single.item.maxQuantity ?? TOME_MAX_QUANTITY
      if (curQty < maxQty) {
        const scrollQty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
        const addQty = Math.min(maxQty - curQty, scrollQty)
        setTomeQuantity(single.item, curQty + addQty)
        if (scrollQty > addQty) {
          setTomeQuantity(cursorItem, scrollQty - addQty)
          return { handled: true, newCursorItem: cursorItem }
        }
        return { handled: true, newCursorItem: null }
      }
    }
    if (canSocketUiItem(cursorItem, single.item)) {
      applySocketToUiItem(single.item, cursorItem)
      const qty = cursorItem.quantity ?? cursorItem.rawItem?.quantity ?? 1
      if (qty > 1) {
        setTomeQuantity(cursorItem, qty - 1)
        return { handled: true, newCursorItem: cursorItem }
      }
      return { handled: true, newCursorItem: null }
    }
    this.cubeItems = this.cubeItems.filter(p => p !== single)
    this.cubeItems.push({ item: cursorItem, col: targetCol, row: targetRow })
    return { handled: true, newCursorItem: single.item }
  }
  return { handled: false, newCursorItem: cursorItem }
}
/**
 * Executes Horadric Cube transmutation recipes (`CubeMain.txt`) on `this.cubeItems`.
 */
export function transmuteCubeImpl(this: WorldPanelsHud): CubeTransmuteResult {
  const res = transmuteCubeItems(this.cubeItems)
  if (res.matched) {
    this.cubeItems = [...res.resultItems]
  }
  return res
}
export function quickTransferToCubeImpl(this: WorldPanelsHud, item: UiInventoryItem, fromInventory: InventoryPanel): boolean {
  const hitIdx = fromInventory.gridItems.findIndex(p => p.item.id === item.id)
  if (hitIdx === -1) return false
  if (!this.autoPlaceInCube(item)) return false
  fromInventory.gridItems.splice(hitIdx, 1)
  return true
}
export function quickTransferFromCubeImpl(this: WorldPanelsHud, item: UiInventoryItem, toInventory: InventoryPanel): boolean {
  const hitIdx = this.cubeItems.findIndex(p => p.item.id === item.id)
  if (hitIdx === -1) return false
  if (!toInventory.autoPlaceInGrid(item)) return false
  this.cubeItems.splice(hitIdx, 1)
  return true
}
