/**
 * Diablo II: Lord of Destruction v1.13c — Ground Item & Drop Entities
 *
 * Implements ground item entities, safe drop radial search algorithms,
 * gold & equipment drop representations, and lifecycle management.
 *
 * Ground Truth:
 * - D2Common.dll (0x6FD40000) ITEM_Drop radial search algorithm
 * - D2Game.dll (0x6FC45670) D2GAME_DropItem / D2Game!6FC319D0 gold amounts
 * - Safe void & collision protection: items must never drop onto COLLIDE_WALL or COLLIDE_MASK_INVALID
 */

import type { UiInventoryItem, UiItemQuality } from './inventory-model.ts'
import type { Item } from './items.ts'
import {
  COLLIDE_WALL,
  COLLIDE_BLANK,
  COLLIDE_WATER,
  COLLIDE_NO_PATH,
  COLLIDE_MASK_INVALID,
  COLLIDE_MASK_PLAYER_PATH,
  COLLIDE_NONE,
  COLLIDE_ITEM,
  COLLIDE_MASK_SPAWN,
  COLLIDE_MASK_SPAWN_LOS,
  ORTHO_CELL_WIDTH,
  ORTHO_CELL_HEIGHT,
  ORTHO_SUB_TILE_WIDTH,
  ORTHO_SUB_TILE_HEIGHT,
  getCollisionMask,
  getCollisionMaskAt,
  isBlockedAt,
  rayTraceScene,
  subTileAt,
} from '../world/d2map.ts'
import type { CollisionGrid } from '../world/d2map.ts'
import {
  resolveBaseItemNameEn,
  translateItemName,
  translateMagicName,
  translateRareName,
} from '../i18n/tooltip-i18n.ts'
import { isRuneCode } from './gems-data.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'

/**
 * Composite collision mask for ground item & gold drops.
 * Combines D2Common.dll `COLLISION_GetFreeCoordinatesImpl` (`COLLIDE_MASK_SPAWN = 0x3E01`)
 * with player walkability masks (`COLLIDE_MASK_PLAYER_PATH`, `COLLIDE_BLANK`, `COLLIDE_WATER`,
 * `COLLIDE_MASK_INVALID`, `COLLIDE_NO_PATH`) so items never land on tiles a player cannot walk onto.
 */
export const COLLIDE_MASK_DROP_BLOCK =
  COLLIDE_MASK_SPAWN |
  COLLIDE_MASK_PLAYER_PATH |
  COLLIDE_BLANK |
  COLLIDE_WATER |
  COLLIDE_MASK_INVALID |
  COLLIDE_NO_PATH


import {
  PLAYER_COLLISION_EXTENT_PX,
  ITEM_COLLISION_EXTENT_PX,
  D2_PICKUP_SUBTILE_REACH_PX,
  getPickupEdgeDistance,
  isWithinPickupBounds,
  calculateBounceHeight,
  triggerFlippyBounce,
  type GroundItemBounceState,
  type GroundItemSource,
  type GroundItemEntity,
} from './ground-item-physics.ts'

export {
  PLAYER_COLLISION_EXTENT_PX,
  ITEM_COLLISION_EXTENT_PX,
  D2_PICKUP_SUBTILE_REACH_PX,
  getPickupEdgeDistance,
  isWithinPickupBounds,
  calculateBounceHeight,
  triggerFlippyBounce,
  type GroundItemBounceState,
  type GroundItemSource,
  type GroundItemEntity,
}

/** Check whether an item source represents gold. */
export function isGoldItem(item: any): boolean {
  if (!item) return false
  if (item.isGold === true) return true
  if (item.code === 'gld' || item.code?.trim() === 'gld') return true
  if (item.id === 'gold') return true
  if (item.base?.id === 'gold' || item.base?.name?.toLowerCase() === 'gold') return true
  if (typeof item.name === 'string' && /gold|\u91d1\u5e01/i.test(item.name)) return true
  return false
}

/** Resolve quality name string safely, including rune detection per D2 1.13c ground label rules. */
export function resolveItemQualityString(quality: any, code?: string, item?: any): string {
  const normCode = typeof code === 'string' ? code.trim().toLowerCase() : ''
  const rawRarity = typeof item?.rarity === 'string' ? item.rarity.toLowerCase() : ''
  if (
    (normCode && isRuneCode(normCode)) ||
    item?.isRune === true ||
    item?.base?.isRune === true ||
    rawRarity === 'rune'
  ) {
    return 'rune'
  }
  if (typeof quality === 'string') return quality.toLowerCase()
  if (typeof quality === 'number') {
    switch (quality) {
      case 1: return 'low'
      case 2: return 'normal'
      case 3: return 'superior'
      case 4: return 'magic'
      case 5: return 'set'
      case 6: return 'rare'
      case 7: return 'unique'
      case 8: return 'craft'
      case 9: return 'tempered'
      default: return 'normal'
    }
  }
  if (item?.uniqueItemDef || rawRarity === 'unique') return 'unique'
  if (item?.setItemDef || rawRarity === 'set') return 'set'
  if (item?.rolledRareAffixes || rawRarity === 'rare') return 'rare'
  if (item?.rolledMagicAffixes || rawRarity === 'magic') return 'magic'
  if (rawRarity === 'crafted' || rawRarity === 'craft') return 'craft'
  return 'normal'
}

/**
 * Canonical 1.13c item codes with `quest != 0` in `misc.txt` / `weapons.txt`,
 * excluding Wirt's Leg (`'leg'`), which `D2Client.dll` (`0x6FB6FF75`, `0x6FB093E5`, `0x6FB4444F`)
 * explicitly excludes from the `nQuest != 0 -> Gold (4)` override.
 */
export const CANONICAL_QUEST_ITEM_CODES: ReadonlySet<string> = new Set([
  'bks', 'bkd', 'hdm', 'ass', 'tr1', 'box', 'hst', 'msf', 'vip',
  'j34', 'g34', 'xyz', 'g33', 'd33', 'bbb', 'qey', 'qhr', 'qbr', 'qf1',
  'qf2', 'mss', 'hfh', 'ice', 'tr2',
])

/**
 * Canonical 1.13c item codes colored Orange (`8` / `\xffc8`) alongside Runes (`ITYPE_RUNE = 74`)
 * in `D2Client.dll` (`0x6FB6FF8C..0x6FB6FFE9`, `0x6FB093FF..0x6FB09457`, `0x6FB44465..0x6FB444C4`):
 * Pandemonium Keys, Uber Organs, Essences, and Token of Absolution.
 */
export const CANONICAL_ORANGE_SPECIAL_ITEM_CODES: ReadonlySet<string> = new Set([
  'ceh', 'bet', 'tes', 'fed', 'toa',
  'dhn', 'bey', 'mbr',
  'pk1', 'pk2', 'pk3',
])

/**
 * Formats an item's Chinese display name into pure Chinese matching `itemToUiInventoryItem` (`src/ui/item-bridge.ts`),
 * without appending `(${name})`.
 */
export function formatBilingualGroundItemName(item: any, name: string, quality: string): string {
  if (typeof item?.nameZh === 'string' && item.nameZh.trim().length > 0 && item.nameZh !== name) {
    return item.nameZh.replace(/\s*\([A-Za-z0-9' -]+\)$/, '')
  }
  const baseEn = typeof item?.base?.name === 'string' && item.base.name.length > 0 ? item.base.name : undefined
  if (quality === 'unique' && item?.uniqueItemDef) {
    const rawUniqueKey = (item.uniqueItemDef.index || name).trim()
    const uEn = resolveBaseItemNameEn(rawUniqueKey) || rawUniqueKey
    const uZh =
      translateItemName(rawUniqueKey) !== rawUniqueKey
        ? translateItemName(rawUniqueKey)
        : translateItemName(uEn)
    return uZh && uZh !== uEn ? uZh : uEn
  }
  if (quality === 'set' && item?.setItemDef) {
    const sEn = item.setItemDef.index || name
    const sZh = translateItemName(sEn)
    return sZh && sZh !== sEn ? sZh : sEn
  }
  if ((quality === 'rare' || quality === 'craft') && item?.rolledRareAffixes) {
    const rEn = item.rolledRareAffixes.name || name
    const rZh = translateRareName(
      rEn,
      item.rolledRareAffixes.rarePrefix?.name ?? item.rolledRareAffixes.prefix1?.name,
      item.rolledRareAffixes.rareSuffix?.name ?? item.rolledRareAffixes.suffix1?.name,
    )
    return rZh && rZh !== rEn ? rZh : rEn
  }
  if (quality === 'magic' && item?.rolledMagicAffixes) {
    const mEn = item.rolledMagicAffixes.name || name
    const rawCode = typeof item?.code === 'string' ? item.code.trim().toLowerCase() : typeof item?.base?.id === 'string' ? item.base.id.trim().toLowerCase() : undefined
    const mZh = translateMagicName(
      mEn,
      baseEn ?? name,
      item.rolledMagicAffixes.prefix?.name ?? item.prefix?.name,
      item.rolledMagicAffixes.suffix?.name ?? item.suffix?.name,
      rawCode,
    )
    return mZh && mZh !== mEn ? mZh : mEn
  }
  const directZh = translateItemName(name)
  if (directZh && directZh !== name) {
    return directZh
  }
  if (quality === 'rare' || quality === 'craft') {
    const rZh = translateRareName(name)
    if (rZh && rZh !== name) return rZh
  }
  if (quality === 'magic') {
    const mZh = translateMagicName(name, baseEn)
    if (mZh && mZh !== name) return mZh
  }
  return name
}

/** Metadata extracted from an item for ground display. */
export interface GroundItemMetadata {
  readonly name: string
  readonly nameZh: string
  readonly labelText: string
  readonly labelEn: string
  readonly labelZh: string
  readonly color: string
  readonly quality: string
  readonly isGold: boolean
  readonly amount: number
  readonly invWidth: number
  readonly invHeight: number
  readonly dropSound?: string | undefined
  readonly dropSfxFrame?: number | undefined
  readonly ethereal?: boolean | undefined
  readonly sockets?: number | undefined
}

function resolveGroundQualityColor(quality: string, ethereal?: boolean, sockets?: number): string {
  switch (quality) {
    case 'unique':
      return '#c4a060'
    case 'set':
      return '#00fc00'
    case 'rare':
      return '#ffff64'
    case 'craft':
      return '#ff8000'
    case 'tempered':
      return '#008000'
    case 'magic':
      return '#4880ff'
    case 'rune':
      return '#ffa500'
    default:
      // D2Client.dll 0x6fb6fef2..0x6fb6ff62 / 0x6fb0935f..0x6fb093cf:
      // quality <= 3 (low, normal, superior) renders Gray (5) if socketed (0x800) or ethereal (0x400000), else White (0).
      return ethereal || (sockets && sockets > 0) ? '#a0a0a0' : '#ffffff'
  }
}

/**
 * Checks whether an item or GroundItemSource is currently unidentified.
 */
export function isGroundSourceUnidentified(item: any): boolean {
  if (!item || isGoldItem(item)) return false
  if (item.identified === false) return true
  if (item.identified === true) return false
  if (item.flags && typeof item.flags.identified === 'boolean') {
    return item.flags.identified === false
  }
  if (item.rawItem && item.rawItem !== item) {
    return isGroundSourceUnidentified(item.rawItem)
  }
  if (item.item && item.item !== item) {
    return isGroundSourceUnidentified(item.item)
  }
  return false
}

/** Extract ground item metadata from any item source. */
export function resolveGroundItemMetadata(item: any, specifiedAmount?: number): GroundItemMetadata {
  const isGold = isGoldItem(item)

  if (isGold) {
    const amount = specifiedAmount ?? (
      typeof item?.goldAmount === 'number'
        ? item.goldAmount
        : typeof item?.quantity === 'number'
          ? item.quantity
          : typeof item?.amount === 'number'
            ? item.amount
            : typeof item?.stack === 'number'
              ? item.stack
              : typeof item?.value === 'number'
                ? item.value
                : 1
    )
    const labelEn = `${amount} Gold`
    const labelZh = `${amount} 金币`
    return {
      name: labelEn,
      nameZh: labelZh,
      labelText: labelEn,
      labelEn,
      labelZh,
      color: '#ffffff',
      quality: 'normal',
      isGold: true,
      amount,
      invWidth: 1,
      invHeight: 1,
      dropSound: 'item_gold',
      dropSfxFrame: 12,
    }
  }

  const rawCode = typeof item?.code === 'string'
    ? item.code.trim().toLowerCase()
    : typeof item?.base?.id === 'string'
      ? item.base.id.trim().toLowerCase()
      : typeof item?.rawItem?.code === 'string'
        ? item.rawItem.code.trim().toLowerCase()
        : typeof item?.rawItem?.base?.id === 'string'
          ? item.rawItem.base.id.trim().toLowerCase()
          : ''

  let tableBase: any
  if (rawCode && (!item?.base || !item?.name || (item?.base?.dropsound === undefined && item?.dropSound === undefined && item?.dropsound === undefined))) {
    try {
      const tables = getEmbeddedDropTables() as any
      tableBase = typeof tables.getBase === 'function'
        ? tables.getBase(rawCode)
        : (tables.weapons?.get(rawCode) ?? tables.armor?.get(rawCode) ?? tables.misc?.get(rawCode))
    } catch {
      // fallback if embedded tables unavailable
    }
  }

  const rawUniqueIdx =
    typeof item?.uniqueItemDef?.index === 'string' && item.uniqueItemDef.index.trim().length > 0
      ? item.uniqueItemDef.index.trim()
      : undefined
  const rawName =
    rawUniqueIdx
      ? resolveBaseItemNameEn(rawUniqueIdx, rawCode)
      : typeof item?.name === 'string' && item.name.trim().length > 0
        ? resolveBaseItemNameEn(item.name, rawCode)
        : rawCode
          ? resolveBaseItemNameEn(tableBase?.name || rawCode.toUpperCase(), rawCode)
          : 'Unknown Item'
  const quality = resolveItemQualityString(item?.quality ?? item?.base?.quality, rawCode, item)
  const unidentified = isGroundSourceUnidentified(item)

  let name = rawName
  let nameZh: string
  if (unidentified) {
    const baseObj = item?.base ?? item?.rawItem?.base ?? tableBase
    const rawBaseName =
      typeof baseObj?.name === 'string' && baseObj.name.trim().length > 0
        ? baseObj.name
        : rawName
    const baseNameEn = resolveBaseItemNameEn(rawBaseName, rawCode)
    const translatedBase =
      translateItemName(rawBaseName) !== rawBaseName
        ? translateItemName(rawBaseName)
        : translateItemName(baseNameEn)
    name = baseNameEn
    nameZh =
      translatedBase && translatedBase !== baseNameEn
        ? translatedBase
        : baseNameEn
  } else {
    nameZh = formatBilingualGroundItemName(item, name, quality)
    if (item && typeof item === 'object' && (!item.nameZh || item.nameZh === name) && nameZh) {
      try {
        item.nameZh = nameZh
      } catch {
        // ignore if frozen object
      }
    }
  }

  const invWidth = typeof item?.invWidth === 'number' ? item.invWidth : (item?.base?.invWidth ?? tableBase?.invWidth ?? 1)
  const invHeight = typeof item?.invHeight === 'number' ? item.invHeight : (item?.base?.invHeight ?? tableBase?.invHeight ?? 1)
  const amount = typeof item?.stack === 'number' ? item.stack : 1
  const dropSound = item?.base?.dropsound ?? item?.dropSound ?? item?.dropsound ?? tableBase?.dropsound ?? 'item_drop'
  const dropSfxFrame = item?.base?.dropsfxframe ?? item?.dropSfxFrame ?? item?.dropsfxframe ?? tableBase?.dropsfxframe ?? 12
  const rawFlagsNum =
    typeof item?.rawFlags === 'number'
      ? item.rawFlags
      : typeof item?.flags === 'number'
        ? item.flags
        : 0
  const ethereal = Boolean(
    item?.ethereal === true ||
      item?.isEthereal === true ||
      item?.flags?.ethereal === true ||
      item?.item?.ethereal === true ||
      (rawFlagsNum & 0x400000) !== 0,
  )
  const rawSockets =
    item?.sockets ??
    item?.totalSockets ??
    item?.socketedCount ??
    item?.item?.sockets ??
    item?.item?.totalSockets ??
    0
  const hasSocketFlag = Boolean(
    item?.socketed === true ||
      item?.flags?.socketed === true ||
      item?.item?.socketed === true ||
      (rawFlagsNum & 0x800) !== 0,
  )
  const sockets =
    typeof rawSockets === 'number' && rawSockets > 0
      ? rawSockets
      : hasSocketFlag
        ? 1
        : undefined
  // D2Client.dll 0x6fb6ff62..0x6fb6ff85 / 0x6fb093cf..0x6fb093f5:
  // nQuest != 0 && dwCode != 'leg ' -> Gold (4)
  const isQuestItem =
    rawCode !== 'leg' &&
    (Boolean(rawCode && CANONICAL_QUEST_ITEM_CODES.has(rawCode)) ||
      (tableBase?.quest ?? item?.base?.quest ?? item?.rawItem?.base?.quest ?? 0) > 0)
  // D2Client.dll 0x6fb6ff86..0x6fb6ffe9 / 0x6fb093f6..0x6fb09457:
  // 11 special codes (keys/organs/essences/token) or ITYPE_RUNE (74) -> Orange (8)
  const isOrangeSpecial =
    quality === 'rune' || Boolean(rawCode && CANONICAL_ORANGE_SPECIAL_ITEM_CODES.has(rawCode))
  let color = resolveGroundQualityColor(quality, ethereal, sockets)
  if (isQuestItem) {
    color = '#c4a060'
  }
  if (isOrangeSpecial) {
    color = '#ffa500'
  }

  return {
    name,
    nameZh,
    labelText: name,
    labelEn: name,
    labelZh: nameZh,
    color,
    quality,
    isGold: false,
    amount,
    invWidth,
    invHeight,
    dropSound,
    dropSfxFrame,
    ...(ethereal ? { ethereal: true } : {}),
    ...(sockets !== undefined ? { sockets } : {}),
  }
}

/**
 * Authentic Diablo II v1.13c Unit Collision Extents & Pickup Reach (`D2Game.dll` `SUNITDMG_IsWithinReach` / `UNITS_GetDistanceToOtherUnit`).
 *
 * - Player collision footprint: `SizeX = 2, SizeY = 2` sub-tiles -> half-extent = 1 sub-tile (`16px`).
 * - Ground item collision footprint: `1 × 1` sub-tile -> half-extent = 1 sub-tile (`16px`).
 * - Sub-tile pickup reach: `<= 4` sub-tiles (`4 * 16px = 64px`) edge-to-edge (`~96px` center-to-center).
 */

/**
 * Concentric quadrant spiral neighbor search around origin (D2Common.dll ITEM_Drop / COLLISION_GetFreeCoordinatesImpl parity).
 * Searches radius 0, 1, 2, ... up to maxRadius in authentic 1.13c quadrant order for the first walkable cell
 * not blocked by COLLIDE_MASK_DROP_BLOCK or player overlap, 4-connected to the drop/player room, and not occupied by existing items.
 */
export function findSafeDropPosition(
  grid: any,
  originCellX: number,
  originCellY: number,
  maxRadius = 3,
  occupied?: readonly { cellX?: number; cellY?: number; x?: number; y?: number }[] | Set<string> | ((cx: number, cy: number) => boolean),
  reachableFromCell?: { cellX: number; cellY: number },
): { cellX: number; cellY: number; x: number; y: number } {
  const targetGrid = grid?.grid ?? grid

  const isBlocked = (cx: number, cy: number): boolean => {
    if (!targetGrid && typeof grid?.overlap !== 'function') return false

    // 1. Function check (e.g. overlap callback or mock in tests)
    if (typeof targetGrid === 'function') {
      return targetGrid(cx, cy) !== 0
    }
    if (typeof targetGrid?.isBlocked === 'function') {
      return targetGrid.isBlocked(cx, cy)
    }

    // 2. Real CollisionGrid (cellsX, cellsY, gridWidth, blocked, optional collisionMasks)
    if (typeof targetGrid?.cellsX === 'number' && typeof targetGrid?.cellsY === 'number') {
      if (cx < 0 || cy < 0 || cx >= targetGrid.cellsX || cy >= targetGrid.cellsY) {
        return true // Out of map bounds -> COLLIDE_MASK_INVALID
      }
      const gridWidth = targetGrid.gridWidth ?? (targetGrid.cellsX * 5)
      // Check center sub-tile (cx * 5 + 2, cy * 5 + 2)
      const subX = cx * 5 + 2
      const subY = cy * 5 + 2
      const subIdx = subY * gridWidth + subX

      if (targetGrid.collisionMasks) {
        const mask = targetGrid.collisionMasks[subIdx] ?? COLLIDE_NONE
        if ((mask & COLLIDE_MASK_DROP_BLOCK) !== 0) {
          return true
        }
      }
      if (targetGrid.blocked && targetGrid.blocked[subIdx] === 1) {
        return true
      }
      if (typeof grid?.overlap === 'function' && grid.widthPx !== undefined && grid.heightPx !== undefined) {
        const oX = typeof grid.originX === 'number'
          ? grid.originX
          : typeof targetGrid.originX === 'number'
            ? targetGrid.originX
            : 0
        const oY = typeof grid.originY === 'number'
          ? grid.originY
          : typeof targetGrid.originY === 'number'
            ? targetGrid.originY
            : 0
        const wx = oX + (cx - cy) * ORTHO_CELL_WIDTH
        const wy = oY + (cx + cy) * ORTHO_CELL_HEIGHT
        if (grid.overlap(wx, wy) > 0) {
          return true
        }
      }
      return false
    }

    // 3. TypedArray directly (e.g. new Uint8Array(400) or new Uint16Array(width * height))
    if (targetGrid && ArrayBuffer.isView(targetGrid)) {
      if (cx < 0 || cy < 0) return true
      const width = typeof (targetGrid as any).width === 'number'
        ? (targetGrid as any).width
        : typeof (targetGrid as any).cellsX === 'number'
          ? (targetGrid as any).cellsX
          : Math.round(Math.sqrt((targetGrid as any).length))
      const height = typeof (targetGrid as any).height === 'number'
        ? (targetGrid as any).height
        : typeof (targetGrid as any).cellsY === 'number'
          ? (targetGrid as any).cellsY
          : width
      if (width > 0 && cx >= width) return true
      if (height > 0 && cy >= height) return true
      const idx = cy * width + cx
      const val = (targetGrid as any)[idx] ?? COLLIDE_NONE
      return (val & COLLIDE_MASK_DROP_BLOCK) !== 0 || val === 1
    }

    // 4. Test grid object with cells or collisionMasks array
    if (targetGrid?.cells || targetGrid?.collisionMasks) {
      if (cx < 0 || cy < 0) return true
      const width = targetGrid.width ?? targetGrid.cellsX ?? 0
      const height = targetGrid.height ?? targetGrid.cellsY ?? 0
      if (typeof width === 'number' && width > 0 && cx >= width) return true
      if (typeof height === 'number' && height > 0 && cy >= height) return true

      const idx = cy * width + cx
      const mask = (targetGrid.collisionMasks ? targetGrid.collisionMasks[idx] : targetGrid.cells[idx]) ?? COLLIDE_NONE
      return (mask & COLLIDE_MASK_DROP_BLOCK) !== 0
    }

    // 5. CountingTerrain / WorldMapProvider overlap callback
    const overlapTarget = typeof grid?.overlap === 'function' ? grid : targetGrid
    if (typeof overlapTarget?.overlap === 'function') {
      if (overlapTarget.widthPx !== undefined && overlapTarget.heightPx !== undefined) {
        const originX = typeof overlapTarget.originX === 'number' ? overlapTarget.originX : 0
        const originY = typeof overlapTarget.originY === 'number' ? overlapTarget.originY : 0
        const wx = originX + (cx - cy) * ORTHO_CELL_WIDTH
        const wy = originY + (cx + cy) * ORTHO_CELL_HEIGHT
        return overlapTarget.overlap(wx, wy) > 0
      }
      return overlapTarget.overlap(cx, cy) !== 0
    }

    return false
  }

  // Build fast occupied set
  const occupiedSet = new Set<string>()
  if (occupied) {
    if (occupied instanceof Set) {
      for (const k of occupied) occupiedSet.add(k)
    } else if (typeof occupied !== 'function' && Array.isArray(occupied)) {
      for (const item of occupied) {
        if (typeof item.cellX === 'number' && typeof item.cellY === 'number') {
          occupiedSet.add(`${item.cellX},${item.cellY}`)
        } else if (typeof item.x === 'number' && typeof item.y === 'number') {
          const originX = typeof grid?.originX === 'number' ? grid.originX : (grid?.grid?.originX ?? 0)
          const originY = typeof grid?.originY === 'number' ? grid.originY : (grid?.grid?.originY ?? 0)
          const px = item.x - originX
          const py = item.y - originY
          const cellX = Math.floor((px / ORTHO_CELL_WIDTH + py / ORTHO_CELL_HEIGHT) / 2)
          const cellY = Math.floor((py / ORTHO_CELL_HEIGHT - px / ORTHO_CELL_WIDTH) / 2)
          occupiedSet.add(`${cellX},${cellY}`)
        }
      }
    }
  }

  const isCellOccupied = (cx: number, cy: number): boolean => {
    if (!occupied) return false
    if (typeof occupied === 'function') return occupied(cx, cy)
    return occupiedSet.has(`${cx},${cy}`)
  }

  // Optional 4-connected reachability from reachableFromCell
  let baseCellX = originCellX
  let baseCellY = originCellY
  let playerReachableCells: Set<string> | null = null

  if (
    reachableFromCell &&
    Number.isFinite(reachableFromCell.cellX) &&
    Number.isFinite(reachableFromCell.cellY) &&
    !isBlocked(reachableFromCell.cellX, reachableFromCell.cellY)
  ) {
    const startX = reachableFromCell.cellX
    const startY = reachableFromCell.cellY
    const margin = Math.max(maxRadius + 4, 12)
    const minX = Math.min(startX, originCellX) - margin
    const maxX = Math.max(startX, originCellX) + margin
    const minY = Math.min(startY, originCellY) - margin
    const maxY = Math.max(startY, originCellY) + margin

    playerReachableCells = new Set<string>([`${startX},${startY}`])
    const queue: [number, number][] = [[startX, startY]]
    let head = 0
    while (head < queue.length && queue.length < 4096) {
      const [cx, cy] = queue[head++]!
      const neighbors: [number, number][] = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue
        const key = `${nx},${ny}`
        if (playerReachableCells.has(key)) continue
        if (isBlocked(nx, ny)) continue
        playerReachableCells.add(key)
        queue.push([nx, ny])
      }
    }

    if (!playerReachableCells.has(`${originCellX},${originCellY}`)) {
      // Snap baseCell to the reachable cell closest to originCell
      let bestX = startX
      let bestY = startY
      let bestL1 = Math.abs(startX - originCellX) + Math.abs(startY - originCellY)
      let bestDistSq = (startX - originCellX) ** 2 + (startY - originCellY) ** 2
      for (const [rx, ry] of queue) {
        const l1 = Math.abs(rx - originCellX) + Math.abs(ry - originCellY)
        const dSq = (rx - originCellX) ** 2 + (ry - originCellY) ** 2
        if (l1 < bestL1 || (l1 === bestL1 && dSq < bestDistSq)) {
          bestL1 = l1
          bestDistSq = dSq
          bestX = rx
          bestY = ry
        }
      }
      baseCellX = bestX
      baseCellY = bestY
    }
  }

  const baseWalkable = !isBlocked(baseCellX, baseCellY)
  let anchorConnectedCells: Set<string> | null = null
  const isConnectedToBase = (cx: number, cy: number): boolean => {
    if (playerReachableCells !== null) {
      return playerReachableCells.has(`${cx},${cy}`)
    }
    if (!baseWalkable) return true
    if (cx === baseCellX && cy === baseCellY) return true

    // Fast greedy 4-way walk check from (baseCellX, baseCellY) to (cx, cy)
    let curX = baseCellX
    let curY = baseCellY
    let greedyOk = true
    while (curX !== cx || curY !== cy) {
      const remX = Math.abs(cx - curX)
      const remY = Math.abs(cy - curY)
      const stepX = curX < cx ? 1 : -1
      const stepY = curY < cy ? 1 : -1
      if (remX >= remY && remX > 0 && !isBlocked(curX + stepX, curY)) {
        curX += stepX
      } else if (remY > 0 && !isBlocked(curX, curY + stepY)) {
        curY += stepY
      } else if (remX > 0 && !isBlocked(curX + stepX, curY)) {
        curX += stepX
      } else {
        greedyOk = false
        break
      }
    }
    if (greedyOk) return true

    if (anchorConnectedCells === null) {
      const bound = Math.max(maxRadius + 2, 6)
      anchorConnectedCells = new Set<string>([`${baseCellX},${baseCellY}`])
      const q: [number, number][] = [[baseCellX, baseCellY]]
      let h = 0
      while (h < q.length && q.length < 1024) {
        const [qx, qy] = q[h++]!
        const nbs: [number, number][] = [
          [qx - 1, qy],
          [qx + 1, qy],
          [qx, qy - 1],
          [qx, qy + 1],
        ]
        for (const [nx, ny] of nbs) {
          if (Math.abs(nx - baseCellX) > bound || Math.abs(ny - baseCellY) > bound) continue
          const k = `${nx},${ny}`
          if (anchorConnectedCells.has(k)) continue
          if (isBlocked(nx, ny)) continue
          anchorConnectedCells.add(k)
          q.push([nx, ny])
        }
      }
    }
    return anchorConnectedCells.has(`${cx},${cy}`)
  }

  let chosenCellX = baseCellX
  let chosenCellY = baseCellY
  let found = false
  let firstWalkableOccupied: { cx: number; cy: number } | null = null

  // Ring 0: check base cell
  if (baseWalkable && isConnectedToBase(baseCellX, baseCellY)) {
    if (!isCellOccupied(baseCellX, baseCellY)) {
      chosenCellX = baseCellX
      chosenCellY = baseCellY
      found = true
    } else {
      firstWalkableOccupied = { cx: baseCellX, cy: baseCellY }
    }
  }

  // Concentric quadrant rings R = 1, 2, ... maxRadius
  if (!found) {
    for (let r = 1; r <= maxRadius; r += 1) {
      const ringCandidates = getIsometricRingCandidates(r)
      for (const cand of ringCandidates) {
        const cx = baseCellX + cand.dx
        const cy = baseCellY + cand.dy

        if (isBlocked(cx, cy) || !isConnectedToBase(cx, cy)) {
          continue
        }

        if (isCellOccupied(cx, cy)) {
          if (firstWalkableOccupied === null) {
            firstWalkableOccupied = { cx, cy }
          }
          continue
        }

        chosenCellX = cx
        chosenCellY = cy
        found = true
        break
      }
      if (found) break
    }
  }

  // Extended escape search when origin itself is blocked and maxRadius > 0
  if (!found && firstWalkableOccupied === null && !baseWalkable && maxRadius > 0) {
    const extendedMax = Math.max(maxRadius, 15)
    for (let r = maxRadius + 1; r <= extendedMax; r += 1) {
      const ringCandidates = getIsometricRingCandidates(r)
      for (const cand of ringCandidates) {
        const cx = baseCellX + cand.dx
        const cy = baseCellY + cand.dy
        if (isBlocked(cx, cy) || !isConnectedToBase(cx, cy)) {
          continue
        }
        if (isCellOccupied(cx, cy)) {
          if (firstWalkableOccupied === null) {
            firstWalkableOccupied = { cx, cy }
          }
          continue
        }
        chosenCellX = cx
        chosenCellY = cy
        found = true
        break
      }
      if (found) break
    }
  }

  // Authentic Fallback:
  // If all candidate cells within maxRadius are occupied, stack on first walkable floor cell
  // rather than escaping into void or walls.
  // If even no walkable cell was found (e.g. solid stone block), fallback to origin.
  if (!found && firstWalkableOccupied !== null) {
    chosenCellX = firstWalkableOccupied.cx
    chosenCellY = firstWalkableOccupied.cy
  }

  // Calculate world coordinates (2:1 isometric projection)
  const originX = typeof grid?.originX === 'number'
    ? grid.originX
    : typeof grid?.grid?.originX === 'number'
      ? grid.grid.originX
      : 0
  const originY = typeof grid?.originY === 'number'
    ? grid.originY
    : typeof grid?.grid?.originY === 'number'
      ? grid.grid.originY
      : 0

  const worldX = originX + (chosenCellX - chosenCellY) * ORTHO_CELL_WIDTH
  const worldY = originY + (chosenCellX + chosenCellY) * ORTHO_CELL_HEIGHT

  return {
    cellX: chosenCellX,
    cellY: chosenCellY,
    x: worldX,
    y: worldY,
  }
}

/** Extract a CollisionGrid from either a direct CollisionGrid or a CountingTerrain wrapper. */
function extractCollisionGrid(isBlocked: any): CollisionGrid | undefined {
  if (!isBlocked || typeof isBlocked !== 'object') return undefined
  if (isBlocked.collisionMasks !== undefined || isBlocked.gridWidth !== undefined) {
    return isBlocked as CollisionGrid
  }
  if (isBlocked.grid && (isBlocked.grid.collisionMasks !== undefined || isBlocked.grid.gridWidth !== undefined)) {
    return isBlocked.grid as CollisionGrid
  }
  return undefined
}

/**
 * Checks whether a single world coordinate `(x, y)` is blocked by terrain collision masks,
 * solid sub-tiles, or the player's physical bounding box (`overlap`).
 */
export function isTerrainPointBlocked(
  x: number,
  y: number,
  isBlocked?: ((x: number, y: number) => boolean) | CollisionGrid | any,
): boolean {
  if (!isBlocked) return false

  const grid = extractCollisionGrid(isBlocked)
  if (grid !== undefined) {
    const mask = getCollisionMaskAt(grid, x, y)
    if ((mask & COLLIDE_MASK_DROP_BLOCK) !== 0) {
      return true
    }
    if (grid.blocked && isBlockedAt(grid, x, y)) {
      return true
    }
  }

  if (typeof isBlocked.overlap === 'function') {
    if (isBlocked.overlap(x, y) !== 0) {
      return true
    }
  }

  if (typeof isBlocked === 'function') {
    if (isBlocked(x, y)) {
      return true
    }
  }

  if (typeof isBlocked.isBlocked === 'function') {
    if (isBlocked.isBlocked(x, y)) {
      return true
    }
  }

  return false
}

/**
 * Checks whether a sub-tile ray from `(fromX, fromY)` to `(toX, toY)` is blocked by
 * `COLLIDE_MASK_SPAWN_LOS`, solid `blocked` sub-tiles, or diagonal wall-corner clipping
 * where two orthogonal wall sub-tiles meet at a diagonal corner.
 */
function isSubTileRayBlocked(
  grid: CollisionGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  const los = rayTraceScene(grid, fromX, fromY, toX, toY, COLLIDE_MASK_SPAWN_LOS)
  if (los.hit) {
    return true
  }

  const start = subTileAt(grid, fromX, fromY)
  const end = subTileAt(grid, toX, toY)
  const gridHeight = grid.cellsY * 5

  const isSubTileSolid = (subX: number, subY: number): boolean => {
    if (subX < 0 || subY < 0 || subX >= grid.gridWidth || subY >= gridHeight) {
      return true
    }
    const mask = getCollisionMask(grid, subX, subY)
    if ((mask & (COLLIDE_MASK_SPAWN_LOS | COLLIDE_MASK_DROP_BLOCK)) !== 0) {
      return true
    }
    if (grid.blocked && grid.blocked[subY * grid.gridWidth + subX] === 1) {
      return true
    }
    return false
  }

  let x0 = start.subX
  let y0 = start.subY
  const x1 = end.subX
  const y1 = end.subY
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let steps = 0

  while (true) {
    if (steps > 0 && isSubTileSolid(x0, y0)) {
      return true
    }
    if (x0 === x1 && y0 === y1) {
      break
    }
    const e2 = 2 * err
    const stepX = e2 > -dy
    const stepY = e2 < dx

    if (stepX && stepY) {
      // Diagonal step across sub-tile corner: block if both shared cardinal neighbors are solid
      if (isSubTileSolid(x0 + sx, y0) && isSubTileSolid(x0, y0 + sy)) {
        return true
      }
    }

    if (stepX) {
      err -= dy
      x0 += sx
    }
    if (stepY) {
      err += dx
      y0 += sy
    }
    steps += 1
  }

  return false
}

/**
 * Helper to check whether a candidate world position is blocked by collision, Line-of-Sight,
 * or diagonal wall-corner pinching.
 */
export function isDropPositionBlocked(
  candX: number,
  candY: number,
  originX: number,
  originY: number,
  isBlocked?: ((x: number, y: number) => boolean) | CollisionGrid | any,
): boolean {
  if (!isBlocked) return false

  if (isTerrainPointBlocked(candX, candY, isBlocked)) {
    return true
  }

  if (candX === originX && candY === originY) {
    return false
  }

  const grid = extractCollisionGrid(isBlocked)
  if (grid !== undefined) {
    if (isSubTileRayBlocked(grid, originX, originY, candX, candY)) {
      return true
    }
  }

  if (typeof isBlocked.hasLineOfSight === 'function') {
    if (!isBlocked.hasLineOfSight(originX, originY, candX, candY)) {
      return true
    }
  }

  // Prevent diagonal corner-clipping on non-grid callbacks for 1-step diagonal sub-tile offsets
  const relX = candX - originX
  const relY = candY - originY
  const dx = Math.round((relX / ORTHO_SUB_TILE_WIDTH + relY / ORTHO_SUB_TILE_HEIGHT) / 2)
  const dy = Math.round((relY / ORTHO_SUB_TILE_HEIGHT - relX / ORTHO_SUB_TILE_WIDTH) / 2)
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    const c1x = originX + dx * ORTHO_SUB_TILE_WIDTH
    const c1y = originY + dx * ORTHO_SUB_TILE_HEIGHT
    const c2x = originX - dy * ORTHO_SUB_TILE_WIDTH
    const c2y = originY + dy * ORTHO_SUB_TILE_HEIGHT
    if (isTerrainPointBlocked(c1x, c1y, isBlocked) && isTerrainPointBlocked(c2x, c2y, isBlocked)) {
      return true
    }
  }

  return false
}

/**
 * Generate candidate offsets on concentric ring R around origin in integer sub-tile space,
 * minimizing Manhattan distance L1 = |dx| + |dy| with authentic Blizzard tie-breaking.
 * Matches D2Common.dll COLLISION_GetFreeCoordinatesImpl (0x6FD9D140).
 */
export function getIsometricRingCandidates(R: number): { dx: number; dy: number; l1: number }[] {
  if (R === 0) return [{ dx: 0, dy: 0, l1: 0 }]
  const cands: { dx: number; dy: number; l1: number; order: number }[] = []
  let order = 0

  // Phase 1: Left and right vertical columns (scan dy with smaller |dy| first for L1 minimization)
  const dyOrder: number[] = [0]
  for (let d = 1; d <= R; d += 1) {
    dyOrder.push(-d, d)
  }

  for (const dy of dyOrder) {
    cands.push({ dx: -R, dy, l1: R + Math.abs(dy), order: order++ })
    cands.push({ dx: R, dy, l1: R + Math.abs(dy), order: order++ })
  }

  // Phase 2: Top and bottom horizontal rows (excluding corners already checked)
  const dxOrder: number[] = [0]
  for (let d = 1; d < R; d += 1) {
    dxOrder.push(d, -d)
  }
  for (const dx of dxOrder) {
    cands.push({ dx, dy: -R, l1: Math.abs(dx) + R, order: order++ })
    cands.push({ dx, dy: R, l1: Math.abs(dx) + R, order: order++ })
  }

  // Sort candidates by L1 Manhattan distance ascending, preserving canonical traversal order for ties
  cands.sort((a, b) => {
    if (a.l1 !== b.l1) return a.l1 - b.l1
    return a.order - b.order
  })

  return cands
}

/**
 * Find an unoccupied, player-reachable isometric grid slot around an origin coordinate.
 *
 * Implements Blizzard Diablo II v1.13c 2:1 isometric diamond grid scatter algorithm:
 * - Sub-tile steps: stepX = 16px, stepY = 8px (2:1 aspect ratio).
 * - Concentric square rings R = 0, 1, 2, ... up to maxRings.
 * - L1 Manhattan distance minimization (|dx| + |dy|).
 * - Collision checks against COLLIDE_MASK_DROP_BLOCK, player footprint overlap, and LoS raycast.
 * - Verifies 4-connected walkable path reachability from the drop anchor (and from `reachableFrom`
 *   when provided), snapping blocked or isolated drop origins to the nearest reachable floor sub-tile.
 * - Prevents item stacking by enforcing minimum spacing (default 16px).
 *
 * @param originX - epicenter X in world coordinates.
 * @param originY - epicenter Y in world coordinates.
 * @param existingItems - array of existing ground items to avoid overlapping with.
 * @param isBlocked - optional collision callback or terrain / collision grid.
 * @param stepX - isometric horizontal lattice step (default ORTHO_SUB_TILE_WIDTH = 16).
 * @param stepY - isometric vertical lattice step (default ORTHO_SUB_TILE_HEIGHT = 8).
 * @param maxRings - max search rings (default 10).
 * @param minSpacing - minimum distance in pixels between ground items (default 16).
 * @param reachableFrom - optional player world coordinates to guarantee the drop is path-reachable by the player.
 */
export function findIsometricDropPosition(
  originX: number,
  originY: number,
  existingItems: readonly { x: number; y: number }[] = [],
  isBlocked?: ((x: number, y: number) => boolean) | CollisionGrid | any,
  stepX = ORTHO_SUB_TILE_WIDTH,
  stepY = ORTHO_SUB_TILE_HEIGHT,
  maxRings = 10,
  minSpacing = 16,
  reachableFrom?: { x: number; y: number },
): { x: number; y: number } {
  const minSpacingSq = minSpacing * minSpacing
  const grid = extractCollisionGrid(isBlocked)

  const coordAt = (baseX: number, baseY: number, dx: number, dy: number): { x: number; y: number } => ({
    x: baseX + (dx - dy) * stepX,
    y: baseY + (dx + dy) * stepY,
  })

  const isPointWalkable = (x: number, y: number): boolean => !isTerrainPointBlocked(x, y, isBlocked)

  const canStepCardinal = (fromX: number, fromY: number, toX: number, toY: number): boolean => {
    if (!isPointWalkable(toX, toY)) return false
    if (grid !== undefined && isSubTileRayBlocked(grid, fromX, fromY, toX, toY)) return false
    if (typeof isBlocked?.hasLineOfSight === 'function' && !isBlocked.hasLineOfSight(fromX, fromY, toX, toY)) {
      return false
    }
    return true
  }

  const canGreedyWalkOnLattice = (
    baseX: number,
    baseY: number,
    fromDx: number,
    fromDy: number,
    toDx: number,
    toDy: number,
  ): boolean => {
    let curDx = fromDx
    let curDy = fromDy
    while (curDx !== toDx || curDy !== toDy) {
      const curPos = coordAt(baseX, baseY, curDx, curDy)
      const remX = Math.abs(toDx - curDx)
      const remY = Math.abs(toDy - curDy)
      const sX = curDx < toDx ? 1 : -1
      const sY = curDy < toDy ? 1 : -1

      const nextPosX = coordAt(baseX, baseY, curDx + sX, curDy)
      const nextPosY = coordAt(baseX, baseY, curDx, curDy + sY)

      if (remX >= remY && remX > 0 && canStepCardinal(curPos.x, curPos.y, nextPosX.x, nextPosX.y)) {
        curDx += sX
      } else if (remY > 0 && canStepCardinal(curPos.x, curPos.y, nextPosY.x, nextPosY.y)) {
        curDy += sY
      } else if (remX > 0 && canStepCardinal(curPos.x, curPos.y, nextPosX.x, nextPosX.y)) {
        curDx += sX
      } else {
        return false
      }
    }
    return true
  }

  // Step 1: Resolve effective reachable anchor (anchorX, anchorY)
  let anchorX = originX
  let anchorY = originY
  const originWalkable = isPointWalkable(originX, originY)
  let playerReachableOffsetsFromOrigin: Set<string> | null = null

  if (
    isBlocked &&
    reachableFrom &&
    Number.isFinite(reachableFrom.x) &&
    Number.isFinite(reachableFrom.y)
  ) {
    const relX = reachableFrom.x - originX
    const relY = reachableFrom.y - originY
    const rawStartDx = Math.round((relX / stepX + relY / stepY) / 2)
    const rawStartDy = Math.round((relY / stepY - relX / stepX) / 2)

    let startNode: { dx: number; dy: number } | null = null
    const rawStartPos = coordAt(originX, originY, rawStartDx, rawStartDy)
    if (isPointWalkable(rawStartPos.x, rawStartPos.y)) {
      startNode = { dx: rawStartDx, dy: rawStartDy }
    } else if (isPointWalkable(reachableFrom.x, reachableFrom.y)) {
      for (const c of getIsometricRingCandidates(1)) {
        const p = coordAt(originX, originY, rawStartDx + c.dx, rawStartDy + c.dy)
        if (isPointWalkable(p.x, p.y)) {
          startNode = { dx: rawStartDx + c.dx, dy: rawStartDy + c.dy }
          break
        }
      }
    } else {
      for (let r = 1; r <= 2 && startNode === null; r += 1) {
        for (const c of getIsometricRingCandidates(r)) {
          const p = coordAt(originX, originY, rawStartDx + c.dx, rawStartDy + c.dy)
          if (isPointWalkable(p.x, p.y)) {
            startNode = { dx: rawStartDx + c.dx, dy: rawStartDy + c.dy }
            break
          }
        }
      }
    }

    if (startNode !== null) {
      const distL1 = Math.abs(startNode.dx) + Math.abs(startNode.dy)
      const directReachable =
        originWalkable &&
        distL1 <= 80 &&
        canGreedyWalkOnLattice(originX, originY, startNode.dx, startNode.dy, 0, 0)

      if (!directReachable && distL1 <= 120) {
        const margin = Math.max(maxRings + 6, 16)
        const minDx = Math.min(startNode.dx, 0) - margin
        const maxDx = Math.max(startNode.dx, 0) + margin
        const minDy = Math.min(startNode.dy, 0) - margin
        const maxDy = Math.max(startNode.dy, 0) + margin

        const visited = new Set<string>([`${startNode.dx},${startNode.dy}`])
        const queue: [number, number][] = [[startNode.dx, startNode.dy]]
        let head = 0
        while (head < queue.length && queue.length < 4096) {
          const [cx, cy] = queue[head++]!
          const curWorld = coordAt(originX, originY, cx, cy)
          const neighbors: [number, number][] = [
            [cx - 1, cy],
            [cx + 1, cy],
            [cx, cy - 1],
            [cx, cy + 1],
          ]
          for (const [nx, ny] of neighbors) {
            if (nx < minDx || nx > maxDx || ny < minDy || ny > maxDy) continue
            const key = `${nx},${ny}`
            if (visited.has(key)) continue
            const nextWorld = coordAt(originX, originY, nx, ny)
            if (!canStepCardinal(curWorld.x, curWorld.y, nextWorld.x, nextWorld.y)) continue
            visited.add(key)
            queue.push([nx, ny])
          }
        }

        playerReachableOffsetsFromOrigin = visited
        if (!visited.has('0,0')) {
          // Snap anchor to the player-reachable coordinate closest to origin (0, 0)
          let snapped = false
          const scanMax = Math.max(maxRings, 20)
          for (let r = 1; r <= scanMax && !snapped; r += 1) {
            for (const cand of getIsometricRingCandidates(r)) {
              if (visited.has(`${cand.dx},${cand.dy}`)) {
                const pos = coordAt(originX, originY, cand.dx, cand.dy)
                anchorX = pos.x
                anchorY = pos.y
                snapped = true
                break
              }
            }
          }
          if (!snapped) {
            let bestDx = startNode.dx
            let bestDy = startNode.dy
            let bestL1 = Math.abs(bestDx) + Math.abs(bestDy)
            let bestSq = bestDx * bestDx + bestDy * bestDy
            for (const [vx, vy] of queue) {
              const l1 = Math.abs(vx) + Math.abs(vy)
              const sq = vx * vx + vy * vy
              if (l1 < bestL1 || (l1 === bestL1 && sq < bestSq)) {
                bestL1 = l1
                bestSq = sq
                bestDx = vx
                bestDy = vy
              }
            }
            const pos = coordAt(originX, originY, bestDx, bestDy)
            anchorX = pos.x
            anchorY = pos.y
          }
        }
      }
    }
  }

  // If anchor is still on a blocked coordinate (e.g. origin inside thick wall/water/void without reachableFrom),
  // snap anchor to the nearest walkable floor coordinate with the largest local connected component.
  if (isBlocked && !isPointWalkable(anchorX, anchorY)) {
    const measureComponentSize = (startX: number, startY: number, cap = 12): number => {
      const seen = new Set<string>(['0,0'])
      const q: [number, number][] = [[0, 0]]
      let h = 0
      while (h < q.length && seen.size < cap) {
        const [qx, qy] = q[h++]!
        const curW = coordAt(startX, startY, qx, qy)
        const nbs: [number, number][] = [
          [qx - 1, qy],
          [qx + 1, qy],
          [qx, qy - 1],
          [qx, qy + 1],
        ]
        for (const [nx, ny] of nbs) {
          const k = `${nx},${ny}`
          if (seen.has(k)) continue
          const nextW = coordAt(startX, startY, nx, ny)
          if (!canStepCardinal(curW.x, curW.y, nextW.x, nextW.y)) continue
          seen.add(k)
          q.push([nx, ny])
          if (seen.size >= cap) break
        }
      }
      return seen.size
    }

    const escapeRings = Math.max(maxRings, 30)
    let fallbackWalkable: { x: number; y: number; size: number } | null = null
    let snapped = false
    for (let r = 1; r <= escapeRings && !snapped; r += 1) {
      for (const cand of getIsometricRingCandidates(r)) {
        const pos = coordAt(originX, originY, cand.dx, cand.dy)
        if (!isPointWalkable(pos.x, pos.y)) continue
        const compSize = measureComponentSize(pos.x, pos.y, 8)
        if (compSize >= 6) {
          anchorX = pos.x
          anchorY = pos.y
          snapped = true
          break
        }
        if (fallbackWalkable === null || compSize > fallbackWalkable.size) {
          fallbackWalkable = { x: pos.x, y: pos.y, size: compSize }
        }
      }
    }
    if (!snapped && fallbackWalkable !== null) {
      anchorX = fallbackWalkable.x
      anchorY = fallbackWalkable.y
    }
  }

  // Step 2: Lazy 4-connected walkable verification around (anchorX, anchorY)
  const anchorWalkable = isPointWalkable(anchorX, anchorY)
  let anchorConnectedOffsets: Set<string> | null = null

  const isCandidateConnectedToAnchor = (dx: number, dy: number): boolean => {
    if (!isBlocked || !anchorWalkable) return true
    if (dx === 0 && dy === 0) return true

    if (canGreedyWalkOnLattice(anchorX, anchorY, 0, 0, dx, dy)) {
      return true
    }

    if (anchorConnectedOffsets === null) {
      const bound = Math.max(maxRings + 4, 14)
      anchorConnectedOffsets = new Set<string>(['0,0'])
      const q: [number, number][] = [[0, 0]]
      let h = 0
      while (h < q.length && q.length < 2048) {
        const [qx, qy] = q[h++]!
        const curW = coordAt(anchorX, anchorY, qx, qy)
        const nbs: [number, number][] = [
          [qx - 1, qy],
          [qx + 1, qy],
          [qx, qy - 1],
          [qx, qy + 1],
        ]
        for (const [nx, ny] of nbs) {
          if (Math.abs(nx) > bound || Math.abs(ny) > bound) continue
          const k = `${nx},${ny}`
          if (anchorConnectedOffsets.has(k)) continue
          const nextW = coordAt(anchorX, anchorY, nx, ny)
          if (!canStepCardinal(curW.x, curW.y, nextW.x, nextW.y)) continue
          anchorConnectedOffsets.add(k)
          q.push([nx, ny])
        }
      }
    }

    return anchorConnectedOffsets.has(`${dx},${dy}`)
  }

  // Step 3: Concentric diamond ring search around (anchorX, anchorY)
  let firstWalkableCandidate: { x: number; y: number } | null = null

  for (let ring = 0; ring <= maxRings; ring += 1) {
    const ringCandidates = getIsometricRingCandidates(ring)

    for (const cand of ringCandidates) {
      const cx = anchorX + (cand.dx - cand.dy) * stepX
      const cy = anchorY + (cand.dx + cand.dy) * stepY

      // Check collision and line of sight from the walkable anchor
      if (isDropPositionBlocked(cx, cy, anchorX, anchorY, isBlocked)) {
        continue
      }

      // Check 4-way walkable connectivity to anchor (prevents clipping across walls/corners)
      if (!isCandidateConnectedToAnchor(cand.dx, cand.dy)) {
        continue
      }

      // If player reachability set was computed on origin lattice, verify candidate is also in it
      if (playerReachableOffsetsFromOrigin !== null && anchorX === originX && anchorY === originY) {
        if (!playerReachableOffsetsFromOrigin.has(`${cand.dx},${cand.dy}`)) {
          continue
        }
      }

      if (firstWalkableCandidate === null) {
        firstWalkableCandidate = { x: cx, y: cy }
      }

      // Check conflict with existing items
      let hasConflict = false
      for (const item of existingItems) {
        const dx = item.x - cx
        const dy = item.y - cy
        const dSq = dx * dx + dy * dy
        if (dSq < minSpacingSq) {
          hasConflict = true
          break
        }
      }

      if (!hasConflict) {
        return { x: cx, y: cy }
      }
    }
  }

  return firstWalkableCandidate ?? { x: anchorX, y: anchorY }
}

/**
 * GroundItemManager maintains all dropped items and gold currently lying on the ground.
 */
export class GroundItemManager {
  private readonly items = new Map<string, GroundItemEntity>()
  private idCounter = 1
  onAdd?: ((entity: GroundItemEntity) => void) | undefined
  onRemove?: ((entity: GroundItemEntity) => void) | undefined
  onClear?: (() => void) | undefined

  /** Next sequential ground item ID counter. */
  get nextId(): number {
    return this.idCounter
  }

  set nextId(value: number) {
    if (Number.isFinite(value) && value >= 1) {
      this.idCounter = Math.floor(value)
    }
  }

  /** All active ground items. */
  get all(): readonly GroundItemEntity[] {
    return Array.from(this.items.values())
  }

  /** Count of active ground items. */
  get count(): number {
    return this.items.size
  }

  /** Add an item or gold to the ground. */
  add(
    item: GroundItemSource,
    cellX: number,
    cellY: number,
    worldX: number,
    worldY: number,
    options?: {
      id?: string | undefined
      amount?: number | undefined
      bounce?: boolean | undefined
      peakHeight?: number | undefined
      peakHeightPx?: number | undefined
      durationMs?: number | undefined
      bounceDurationMs?: number | undefined
      now?: number | undefined
    },
  ): GroundItemEntity {
    let seqId: number
    let id: string
    if (typeof options?.id === 'string' && options.id.length > 0) {
      id = options.id
      const match = id.match(/(\d+)$/)
      seqId = match ? Number(match[1]) : this.idCounter++
      if (seqId >= this.idCounter) {
        this.idCounter = seqId + 1
      }
    } else {
      seqId = this.idCounter++
      id = `ground_item_${seqId}`
    }
    const meta = resolveGroundItemMetadata(item, options?.amount)
    const now = options?.now ?? 0
    const sparklePhase = (((seqId * 0x9e3779b9) >>> 0) / 0x100000000) * Math.PI * 2
    const hasBounce =
      options?.bounce ??
      (options?.durationMs !== undefined ||
        options?.bounceDurationMs !== undefined ||
        options?.peakHeight !== undefined ||
        options?.peakHeightPx !== undefined)

    const entity: GroundItemEntity = {
      id,
      item,
      name: meta.name,
      nameZh: meta.nameZh,
      quality: meta.quality,
      isGold: meta.isGold,
      amount: meta.amount,
      invWidth: meta.invWidth,
      invHeight: meta.invHeight,
      dropTime: now,
      x: worldX,
      y: worldY,
      cellX,
      cellY,
      sparklePhase,
      bounceState: hasBounce
        ? {
            startTime: now,
            durationMs: options?.durationMs ?? options?.bounceDurationMs ?? 400,
            peakHeightPx: options?.peakHeight ?? options?.peakHeightPx ?? 24,
            phase: 'primary',
          }
        : null,
      dropSound: meta.dropSound,
      dropSfxFrame: meta.dropSfxFrame,
      sfxPlayed: false,
      ...(meta.ethereal !== undefined ? { ethereal: meta.ethereal } : {}),
      ...(meta.sockets !== undefined ? { sockets: meta.sockets } : {}),
    }
    Object.defineProperty(entity, 'goldAmount', {
      get: () => entity.amount,
      enumerable: false,
      configurable: true,
    })

    this.items.set(id, entity)
    this.onAdd?.(entity)
    return entity
  }

  /**
   * Spawn a gold pile entity at world coordinates `(x, y)` with `amount` gold.
   */
  spawnGold(x: number, y: number, amount: number, now = 0): GroundItemEntity {
    const validAmount = Math.max(1, Math.floor(amount))
    const cellX = Math.floor(x / 160)
    const cellY = Math.floor(y / 80)
    return this.add(
      { code: 'gld', name: `${validAmount} Gold`, stack: validAmount },
      cellX,
      cellY,
      x,
      y,
      { amount: validAmount, now, bounce: true },
    )
  }

  /**
   * Advance ground item bounce states and record landing frame
   * when animation reaches dropsfxframe (or on bounce landing).
   */
  updateBounces(
    now: number,
  ): readonly { entityId: string; sound: string; frame: number }[] {
    const triggered: { entityId: string; sound: string; frame: number }[] = []
    for (const entity of this.items.values()) {
      if (!entity.bounceState || entity.sfxPlayed) continue
      const elapsed = now - entity.bounceState.startTime
      // 25 fps simulation = 40ms per frame
      const currentFrame = Math.floor(elapsed / 40)
      const targetFrame = entity.dropSfxFrame ?? 12
      const landed = elapsed >= entity.bounceState.durationMs

      if (currentFrame >= targetFrame || landed) {
        const sound = entity.dropSound || 'item_drop'
        entity.sfxPlayed = true
        triggered.push({ entityId: entity.id, sound, frame: currentFrame })
      }
    }
    return triggered
  }

  /** Add an existing ground item entity. */
  addEntity(entity: GroundItemEntity): GroundItemEntity {
    this.items.set(entity.id, entity)
    this.onAdd?.(entity)
    return entity
  }

  /** Remove a ground item by id (e.g. when picked up). */
  remove(id: string | number): GroundItemEntity | undefined {
    const strId = String(id)
    const entity = this.items.get(strId)
    if (entity) {
      this.items.delete(strId)
      this.onRemove?.(entity)
    }
    return entity
  }

  /** Retrieve an entity by id. */
  get(id: string | number): GroundItemEntity | undefined {
    return this.items.get(String(id))
  }

  /** Clear all ground items. */
  clear(): void {
    this.items.clear()
    this.idCounter = 1
    this.onClear?.()
  }

  /** Find the nearest ground item within hit radius. */
  findAtPoint(x: number, y: number, hitRadiusPx = 25): GroundItemEntity | null {
    let closest: GroundItemEntity | null = null
    let minDistSq = hitRadiusPx * hitRadiusPx
    for (const item of this.items.values()) {
      const dx = item.x - x
      const dy = item.y - y
      const distSq = dx * dx + dy * dy
      if (distSq <= minDistSq) {
        minDistSq = distSq
        closest = item
      }
    }
    return closest
  }

  /** Find all ground items within radius. */
  findNearby(x: number, y: number, radiusPx: number): GroundItemEntity[] {
    const radiusSq = radiusPx * radiusPx
    const result: GroundItemEntity[] = []
    for (const item of this.items.values()) {
      const dx = item.x - x
      const dy = item.y - y
      if (dx * dx + dy * dy <= radiusSq) {
        result.push(item)
      }
    }
    return result
  }

  /** Advance sparkle phase and bounce animations. */
  update(now: number, deltaMs: number): void {
    for (const item of this.items.values()) {
      item.sparklePhase = (item.sparklePhase + deltaMs * 0.005) % (Math.PI * 2)

      if (item.bounceState) {
        const elapsed = now - item.bounceState.startTime
        if (elapsed >= item.bounceState.durationMs) {
          if (item.bounceState.phase === 'primary') {
            // Secondary bounce: 25% peak height, half duration
            item.bounceState = {
              startTime: item.bounceState.startTime + item.bounceState.durationMs,
              durationMs: Math.round(item.bounceState.durationMs * 0.5),
              peakHeightPx: Math.max(4, Math.round(item.bounceState.peakHeightPx * 0.25)),
              phase: 'secondary',
            }
          } else {
            item.bounceState = null
          }
        }
      }
    }
  }

  /** Get visual render offset including bounce height. */
  getRenderOffset(item: GroundItemEntity, now: number): { x: number; y: number } {
    if (!item.bounceState) return { x: 0, y: 0 }
    const h = calculateBounceHeight(item.bounceState, now)
    return { x: 0, y: -h }
  }

  /** Trigger flippy bounce by ground item ID. */
  triggerBounce(id: string, now?: number, options?: Partial<GroundItemBounceState>): boolean {
    const item = this.items.get(id)
    if (!item) return false
    triggerFlippyBounce(item, now, options)
    return true
  }
}

export interface GroundItemLabelInput {
  readonly id: number
  readonly text?: string | undefined
  readonly label?: string | undefined
  readonly color?: string | undefined
  readonly screenX: number
  readonly screenY: number
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly isHovered?: boolean | undefined
}

export interface GroundItemLabelBox {
  readonly id: number
  readonly text: string
  readonly label: string
  readonly color: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly isHovered?: boolean | undefined
}

export function layoutGroundItemLabels(
  labels: readonly GroundItemLabelInput[],
  viewportW = 800,
  viewportH = 600,
): readonly GroundItemLabelBox[] {
  const placed: GroundItemLabelBox[] = []
  for (const item of labels) {
    const txt = item.text ?? item.label ?? ''
    const w = item.width ?? Math.max(40, txt.length * 7 + 12)
    const h = item.height ?? 18
    const x = Math.max(0, Math.min(Math.max(0, viewportW - w), Math.round(item.screenX - w / 2)))
    let y = Math.max(0, Math.min(Math.max(0, viewportH - h), Math.round(item.screenY - h)))
    let safety = 0
    while (
      safety < 100 &&
      placed.some(
        (b) =>
          x < b.x + b.width &&
          x + w > b.x &&
          y < b.y + b.height &&
          y + h > b.y,
      )
    ) {
      if (y - (h + 2) >= 0) {
        y -= h + 2
      } else {
        y += h + 2
      }
      safety++
    }
    placed.push({
      id: item.id,
      text: txt,
      label: txt,
      color: item.color ?? '#ffffff',
      x,
      y,
      width: w,
      height: h,
      ...(item.isHovered !== undefined ? { isHovered: item.isHovered } : {}),
    })
  }
  return placed
}

export interface WorldCellOriginProvider {
  readonly originX?: number | undefined
  readonly originY?: number | undefined
  readonly grid?: {
    readonly originX?: number | undefined
    readonly originY?: number | undefined
  } | undefined
  readonly worldToGrid?: ((wx: number, wy: number) => { cellX: number; cellY: number }) | undefined
}

/**
 * Project world pixel coordinates back to map cell coordinates.
 *
 * Inverts the 2:1 isometric diamond projection:
 * px = worldX - originX, py = worldY - originY
 * cellX = floor((px / 80 + py / 40) / 2)
 * cellY = floor((py / 40 - px / 80) / 2)
 */
export function worldToCell(
  terrain: WorldCellOriginProvider | Record<string, any> | null | undefined,
  worldX: number,
  worldY: number,
): { cellX: number; cellY: number; cx: number; cy: number }
export function worldToCell(
  worldX: number,
  worldY: number,
): { cellX: number; cellY: number; cx: number; cy: number }
export function worldToCell(
  terrainOrWx: WorldCellOriginProvider | Record<string, any> | number | null | undefined,
  worldX: number,
  worldY?: number,
): { cellX: number; cellY: number; cx: number; cy: number } {
  if (typeof terrainOrWx === 'number') {
    const wx = terrainOrWx
    const wy = worldX
    const cellX = Math.floor((wx / ORTHO_CELL_WIDTH + wy / ORTHO_CELL_HEIGHT) / 2)
    const cellY = Math.floor((wy / ORTHO_CELL_HEIGHT - wx / ORTHO_CELL_WIDTH) / 2)
    return {
      cellX,
      cellY,
      cx: Math.floor(wx / ORTHO_CELL_WIDTH),
      cy: Math.floor(wy / ORTHO_CELL_HEIGHT),
    }
  }
  const wx = worldX
  const wy = worldY ?? 0
  if (terrainOrWx && typeof (terrainOrWx as any).worldToGrid === 'function') {
    const res = (terrainOrWx as any).worldToGrid(wx, wy)
    return {
      cellX: res.cellX,
      cellY: res.cellY,
      cx: res.cellX,
      cy: res.cellY,
    }
  }
  const originX = (terrainOrWx as any)?.originX ?? (terrainOrWx as any)?.grid?.originX ?? 0
  const originY = (terrainOrWx as any)?.originY ?? (terrainOrWx as any)?.grid?.originY ?? 0
  const px = wx - originX
  const py = wy - originY
  const cellX = Math.floor((px / ORTHO_CELL_WIDTH + py / ORTHO_CELL_HEIGHT) / 2)
  const cellY = Math.floor((py / ORTHO_CELL_HEIGHT - px / ORTHO_CELL_WIDTH) / 2)
  return {
    cellX,
    cellY,
    cx: Math.floor(px / ORTHO_CELL_WIDTH),
    cy: Math.floor(py / ORTHO_CELL_HEIGHT),
  }
}

