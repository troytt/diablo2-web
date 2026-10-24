/**
 * Pure Inventory & Paperdoll Slot Data Model (`src/common/items/inventory-model.ts`).
 *
 * Shared across `src/common/`, `src/server/`, and `src/client/`.
 * Zero DOM or Node globals.
 */

import type { Item } from './items.ts'
import type { CharacterClassCode } from '../units/classes.ts'
import type { D2ColorCode } from '../skills/skills-meta.ts'
import type { WeaponDamageInfo } from './item-tooltip.ts'

export type { WeaponDamageInfo }

export const INV_COLS = 10
export const INV_ROWS = 4

/**
 * Diablo II v1.13c stash gold cap (`D2Common.dll` ordinal #11060 returns 2,500,000).
 * The character inventory has no fixed cap; see {@link getInventoryGoldLimit}.
 */
export const STASH_GOLD_CAP = 2_500_000

/**
 * Authentic Diablo II 1.13c Inventory Gold Limit (`D2Common/src/Units/Units.cpp:3103`, ordinal #10459).
 * Character inventory gold is strictly capped at `10,000 * player.level`.
 */
export function getInventoryGoldLimit(level: number): number {
  const safeLevel = Math.max(1, Math.min(99, Math.floor(level || 1)))
  return safeLevel * 10_000
}

/**
 * Authentic Diablo II 1.13c Stash Gold Limit (`D2Common.dll` ordinal #10439 `UNITS_GetStashGoldLimit`).
 * - `clvl < 30`: `(floor(clvl / 10) + 1) * 50,000` (50k at 1..9, 100k at 10..19, 150k at 20..29)
 * - `clvl >= 30`: `min(2,500,000, (floor(clvl / 2) + 1) * 50,000)` (800k at 30..31 up to 2,500,000)
 */
export function getStashGoldLimit(level: number): number {
  const clvl = Math.max(1, Math.min(99, Math.floor(Number.isFinite(level) ? level : 1)))
  if (clvl < 30) {
    return (Math.floor(clvl / 10) + 1) * 50_000
  }
  return Math.min(STASH_GOLD_CAP, (Math.floor(clvl / 2) + 1) * 50_000)
}

export type EquipSlotId =
  | 'helm'
  | 'amulet'
  | 'weapon1'
  | 'armor'
  | 'weapon2'
  | 'gloves'
  | 'ring1'
  | 'belt'
  | 'ring2'
  | 'boots'

export type UiItemQuality = 'normal' | 'magic' | 'rare' | 'set' | 'unique' | 'craft' | 'rune'

export interface UiInventoryItem {
  readonly id: string
  readonly code: string
  readonly invFile: string
  readonly spriteCode?: string | undefined
  readonly baseInvFile?: string | undefined
  readonly name: string
  readonly nameZh: string
  readonly baseNameZh: string
  readonly baseNameEn?: string | undefined
  readonly quality: UiItemQuality
  readonly invWidth: number
  readonly invHeight: number
  readonly gridW?: number | undefined
  readonly gridH?: number | undefined
  readonly allowedSlots: readonly EquipSlotId[]
  readonly slotType?: string | undefined
  readonly twoHanded?: boolean | undefined
  readonly oneOrTwoHanded?: boolean | undefined
  readonly defense?: number | undefined
  readonly baseDefense?: number | undefined
  readonly oneHandDamage?: WeaponDamageInfo | undefined
  readonly twoHandDamage?: WeaponDamageInfo | undefined
  readonly throwDamage?: WeaponDamageInfo | undefined
  readonly damage?: string | undefined
  readonly damageEn?: string | undefined
  readonly reqLevel?: number | undefined
  readonly reqStr?: number | undefined
  readonly reqDex?: number | undefined
  readonly reqClass?: CharacterClassCode | undefined
  readonly stats: readonly { text: string; color?: D2ColorCode }[]
  readonly statsEn?: readonly { text: string; color?: D2ColorCode }[] | undefined
  readonly invtransform?: string | undefined
  readonly chrtransform?: string | undefined
  readonly durability?: { readonly current: number; readonly max: number } | undefined
  readonly speedText?: string | undefined
  readonly speedTextEn?: string | undefined
  readonly runewordRunes?: string | undefined
  readonly sockets?: number | undefined
  readonly usedSockets?: number | undefined
  readonly socketedItems?: readonly UiInventoryItem[] | undefined
  readonly socketedGems?: readonly string[] | undefined
  readonly affixes?: readonly string[] | undefined
  readonly ethereal?: boolean | undefined
  readonly setName?: string | undefined
  readonly setNameEn?: string | undefined
  readonly setPieces?: readonly string[] | undefined
  readonly setPiecesEn?: readonly string[] | undefined
  readonly setPieceColors?: readonly D2ColorCode[] | undefined
  readonly setBonuses?: readonly { text: string; color?: D2ColorCode }[] | undefined
  readonly setBonusesEn?: readonly { text: string; color?: D2ColorCode }[] | undefined
  readonly flippyFile?: string | undefined
  readonly dropSound?: string | undefined
  readonly dropSfxFrame?: number | undefined
  readonly rawItem?: Item | undefined
  readonly buyCost?: number | undefined
  readonly sellCost?: number | undefined
  readonly sellPrice?: number | undefined
  readonly repairCost?: number | undefined
  readonly permStore?: boolean | undefined
  readonly isGambleMystery?: boolean | undefined
  readonly identified?: boolean | undefined
  readonly quantity?: number | undefined
  readonly maxQuantity?: number | undefined
}

export interface GridPlacement {
  readonly item: UiInventoryItem
  readonly col: number
  readonly row: number
}

/**
 * Find the first available `(col, row)` slot for an item in a grid without overlaps.
 * Supports both `readonly GridPlacement[]` and a 2D occupancy grid `readonly (readonly unknown[])[]`.
 */
export function findFreeGridSlot(
  gridItems: readonly GridPlacement[],
  invWidth: number,
  invHeight: number,
  totalCols?: number,
  totalRows?: number,
): { col: number; row: number } | null
export function findFreeGridSlot(
  grid2d: readonly (readonly unknown[])[],
  invWidth: number,
  invHeight: number,
  totalCols?: number,
  totalRows?: number,
): { col: number; row: number; x: number; y: number } | null
export function findFreeGridSlot(
  gridOrItems: readonly GridPlacement[] | readonly (readonly unknown[])[],
  invWidth: number,
  invHeight: number,
  totalCols = INV_COLS,
  totalRows = INV_ROWS,
): { col: number; row: number; x?: number; y?: number } | null {
  if (invWidth <= 0 || invHeight <= 0) return null

  // 2D occupancy array (`grid[row][col]`)
  if (gridOrItems.length > 0 && Array.isArray(gridOrItems[0])) {
    const grid2d = gridOrItems as readonly (readonly unknown[])[]
    const rows = grid2d.length
    const cols = grid2d[0]?.length ?? totalCols
    if (invWidth > cols || invHeight > rows) return null
    for (let r = 0; r <= rows - invHeight; r += 1) {
      for (let c = 0; c <= cols - invWidth; c += 1) {
        let free = true
        for (let dy = 0; dy < invHeight && free; dy += 1) {
          const rowArr = grid2d[r + dy]
          if (!rowArr) {
            free = false
            break
          }
          for (let dx = 0; dx < invWidth; dx += 1) {
            if (rowArr[c + dx] !== null && rowArr[c + dx] !== undefined) {
              free = false
              break
            }
          }
        }
        if (free) {
          const res = { x: c, y: r } as unknown as { col: number; row: number; x?: number; y?: number }
          Object.defineProperties(res, {
            col: { value: c, enumerable: false },
            row: { value: r, enumerable: false },
          })
          return res
        }
      }
    }
    return null
  }

  // GridPlacement[] list
  if (invWidth > totalCols || invHeight > totalRows) return null
  const gridItems = gridOrItems as readonly GridPlacement[]
  for (let r = 0; r <= totalRows - invHeight; r += 1) {
    for (let c = 0; c <= totalCols - invWidth; c += 1) {
      const overlaps = gridItems.some(p => {
        const ox = c < p.col + p.item.invWidth && c + invWidth > p.col
        const oy = r < p.row + p.item.invHeight && r + invHeight > p.row
        return ox && oy
      })
      if (!overlaps) {
        return { col: c, row: r }
      }
    }
  }
  return null
}
