/**
 * Diablo II v1.13c Belt & Pop-up Belt (`Panel\ctrlpnl_popbelt.dc6`).
 *
 * Implements:
 * - 4 columns × 4 rows (16 slots) potion belt storage
 * - Bottom row (slots 1..4) always visible in the 800x600 control panel at x=423, y=562
 * - Hover or `~` key toggles full pop-up rows (`ctrlpnl_popbelt.dc6`, 125×32 per row) based on equipped belt rows
 * - Pressing `1`–`4` or right-clicking drinks the bottom potion in that column and automatically
 *   gravity-shifts upper rows down (`row 1 -> 0`, `row 2 -> 1`, `row 3 -> 2`)
 */

import type { D2FontRenderer } from './font.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'

import {
  BELT_COLS,
  BELT_ROWS,
  BELT_BASE_X,
  BELT_BASE_Y,
  BELT_BASE_X_640,
  BELT_BASE_Y_640,
  BELT_PITCH,
  BELT_PITCH_X,
  BELT_PITCH_Y,
  BELT_CELL_SIZE,
  getBeltSlotBox,
  BELT_CODE_TO_ROWS,
  getBeltRowsForCode,
  BELT_POTION_CATALOG,
  areBeltPotionsCompatible,
  itemToBeltPotion,
  isAutoBeltablePotion,
  BeltModel,
  type BeltPotionKind,
  type BeltPotionCategory,
  type BeltPotion,
} from '../../common/items/belt-model.ts'

export {
  BELT_COLS,
  BELT_ROWS,
  BELT_BASE_X,
  BELT_BASE_Y,
  BELT_BASE_X_640,
  BELT_BASE_Y_640,
  BELT_PITCH,
  BELT_PITCH_X,
  BELT_PITCH_Y,
  BELT_CELL_SIZE,
  getBeltSlotBox,
  BELT_CODE_TO_ROWS,
  getBeltRowsForCode,
  BELT_POTION_CATALOG,
  areBeltPotionsCompatible,
  itemToBeltPotion,
  isAutoBeltablePotion,
  BeltModel,
  type BeltPotionKind,
  type BeltPotionCategory,
  type BeltPotion,
}

export class BeltHud extends BeltModel {
  draw(
    ctx: CanvasRenderingContext2D,
    assets: {
      popbeltImg: HTMLImageElement | null
      itemsAtlasImg: HTMLImageElement | null
      itemRects: Record<string, { x: number; y: number; w: number; h: number }>
    },
    font: D2FontRenderer,
  ): void {
    const visibleRows = this.isExpanded ? this.maxRows : 1
    const baseX = this.is640 ? BELT_BASE_X_640 : BELT_BASE_X
    const baseY = this.is640 ? BELT_BASE_Y_640 : BELT_BASE_Y

    // Draw expanded rows 1..maxRows-1 background (`ctrlpnl_popbelt.dc6`)
    if (visibleRows > 1) {
      for (let row = 1; row < visibleRows; row++) {
        const sy = baseY - row * BELT_PITCH_Y - 2
        if (assets.popbeltImg) {
          ctx.drawImage(assets.popbeltImg, baseX - 1, sy)
        } else {
          reportMissingArt('ui-belt', 'ctrlpnl_popbelt', 'Missing popbelt background art')
        }
      }
    }

    // Draw each cell & potion sprite
    for (let row = 0; row < visibleRows; row++) {
      for (let col = 0; col < BELT_COLS; col++) {
        const box = getBeltSlotBox(col, row, this.is640)
        const sx = box.x
        const sy = box.y
        const pot = this.grid[row]![col]
        const isHovered = this.hoveredSlot?.row === row && this.hoveredSlot?.col === col

        if (isHovered) {
          ctx.fillStyle = 'rgba(200, 161, 90, 0.24)'
          ctx.fillRect(sx, sy, BELT_CELL_SIZE, BELT_CELL_SIZE)
        }

        if (pot) {
          const rect = assets.itemRects[pot.invFile]
          if (assets.itemsAtlasImg && rect) {
            const dx = sx + Math.floor((BELT_CELL_SIZE - rect.w) / 2)
            const dy = sy + Math.floor((BELT_CELL_SIZE - rect.h) / 2)
            ctx.drawImage(assets.itemsAtlasImg, rect.x, rect.y, rect.w, rect.h, dx, dy, rect.w, rect.h)
          } else {
            reportMissingArt('ui-belt', pot.invFile || 'potion', 'Missing potion sprite art')
          }
        }

        // Draw hotkey badge `1`..`4` on bottom row (row 0)
        if (row === 0) {
          font.drawText(ctx, String(col + 1), sx + 3, sy + 27, {
            font: 'font8',
            color: 'gold',
          })
        }
      }
    }
  }
}
