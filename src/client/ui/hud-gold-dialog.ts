/**
 * Diablo II v1.13c Gold Drop / Deposit / Withdraw / Trade Modal Dialog (`src/client/ui/hud-gold-dialog.ts`).
 *
 * Extracted from `hud-manager.ts`:
 * - Mode `0`: Drop gold from inventory (`strDropGoldHowMuch`, `0x50 DropGold`)
 * - Mode `2`: Trade gold offer (`strDropGoldHowMuch`, `0x4F 0x07` + `0x4F 0x08`)
 * - Mode `3`: Deposit gold to stash (`strBankGoldDeposit`, `0x4F 0x14`)
 * - Mode `4`: Withdraw gold from stash (`strBankGoldWithdraw`, `0x4F 0x13`)
 */

import { requireTbl } from '../i18n/lang.ts'
import { getInventoryGoldLimit, getStashGoldLimit } from '../../common/items/inventory-model.ts'
import { drawStoneBoxFrame } from './world-panels.ts'
import type { HudCommandSink, HudManager } from './hud-manager.ts'

export type GoldDialogMode = 0 | 2 | 3 | 4

export interface GoldDialogRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface GoldDialogState {
  mode: GoldDialogMode
  amount: number
  fresh: boolean
}

export interface GoldDialogLayout {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly ok: GoldDialogRect
  readonly cancel: GoldDialogRect
}

function requireHudSink(hud: HudManager, action: string): HudCommandSink {
  const sink = hud.commandSink
  if (!sink) throw new Error(`HudManager.${action}: no server command sink attached`)
  return sink
}

export function resolveHudPlayerLevel(hud: HudManager): number {
  const charLvl = Number(hud.charSheet?.attrs?.level ?? 0)
  const invExplicit = Boolean(
    (hud.inventory as { _playerLevelExplicitlySet?: boolean } | undefined)?._playerLevelExplicitlySet,
  )
  const invLvl = Number(hud.inventory?.playerLevel ?? 0)
  const ctxLvl = Number(hud.inventory?.playerContext?.level ?? 0)
  const wpLvl = Number(
    (hud.worldPanels as { localPlayerLevel?: number } | undefined)?.localPlayerLevel ?? 0,
  )
  if (charLvl > 1) return charLvl
  if (invExplicit && invLvl >= 1) return invLvl
  if (ctxLvl > 1) return ctxLvl
  if (wpLvl > 1) return wpLvl
  return Math.max(1, charLvl || invLvl || ctxLvl || wpLvl || 1)
}

/**
 * Maximum gold transferable in `mode` (`D2Client.dll` gold keypad dialog):
 * - Deposit (`3`): `min(inventory.gold, max(0, getStashGoldLimit(clvl) - stashGold))`
 * - Withdraw (`4`): `min(stashGold, max(0, getInventoryGoldLimit(clvl) - inventory.gold))`
 * - Drop (`0`) / Trade (`2`): `inventory.gold`
 */
export function goldDialogBalance(
  hud: HudManager,
  mode: GoldDialogMode | 'Drop' | 'Trade' | 'Deposit' | 'Withdraw' | null,
): number {
  const clvl = resolveHudPlayerLevel(hud)
  const invGold = Math.max(0, Math.floor(hud.inventory?.gold ?? 0))
  const stashGold = Math.max(0, Math.floor(hud.worldPanels?.stashGold ?? 0))
  if (mode === 3 || mode === 'Deposit') {
    const stashCap = getStashGoldLimit(clvl)
    const stashRoom = Math.max(0, stashCap - stashGold)
    return Math.min(invGold, stashRoom)
  }
  if (mode === 4 || mode === 'Withdraw') {
    const invCap = getInventoryGoldLimit(clvl)
    const invRoom = Math.max(0, invCap - invGold)
    return Math.min(stashGold, invRoom)
  }
  return invGold
}

/** Open the gold dialog pre-filled with the clamped transferable balance (`maxTransfer`). */
export function openGoldDialog(hud: HudManager, mode: GoldDialogMode): void {
  if (mode === 2 && hud.leftPanel !== 'trade') {
    throw new Error('HudManager.openGoldDialog: trade gold needs the trade panel open')
  }
  if (mode === 3 && hud.leftPanel !== 'stash') {
    throw new Error('HudManager.openGoldDialog: deposit needs the stash open')
  }
  if (mode === 4 && hud.leftPanel !== 'stash') {
    throw new Error('HudManager.openGoldDialog: withdraw needs the stash open')
  }
  const maxTransfer =
    typeof hud.goldDialogBalance === 'function' ? hud.goldDialogBalance(mode) : goldDialogBalance(hud, mode)
  if ((mode === 0 || mode === 3 || mode === 4) && maxTransfer <= 0) {
    return
  }
  hud.goldDialog = { mode, amount: maxTransfer, fresh: true }
  hud.syncPublishedState()
}

/** Set the typed amount, clamped to `0 .. source balance`. */
export function setGoldDialogAmount(hud: HudManager, amount: number): void {
  const dlg = hud.goldDialog
  if (!dlg) throw new Error('HudManager.setGoldDialogAmount: gold dialog is not open')
  if (!Number.isFinite(amount)) throw new Error(`HudManager.setGoldDialogAmount: invalid amount ${amount}`)
  dlg.amount = Math.max(0, Math.min(hud.goldDialogBalance(dlg.mode), Math.floor(amount)))
  dlg.fresh = false
}

/** Digit / Backspace editing; the first digit after opening replaces the pre-filled amount. */
export function typeGoldDialogKey(hud: HudManager, key: string): void {
  const dlg = hud.goldDialog
  if (!dlg) throw new Error('HudManager.typeGoldDialogKey: gold dialog is not open')
  if (key === 'Backspace') {
    hud.setGoldDialogAmount(dlg.fresh ? 0 : Math.floor(dlg.amount / 10))
  } else if (/^[0-9]$/.test(key)) {
    hud.setGoldDialogAmount((dlg.fresh ? 0 : dlg.amount) * 10 + Number(key))
  }
}

/** "ok": send the request for the clamped amount (nothing for 0) and close the dialog. */
export function confirmGoldDialog(hud: HudManager): void {
  const dlg = hud.goldDialog
  if (!dlg) throw new Error('HudManager.confirmGoldDialog: gold dialog is not open')
  const amount = Math.max(0, Math.min(hud.goldDialogBalance(dlg.mode), dlg.amount))
  hud.goldDialog = null
  if (dlg.mode === 2) {
    // D2Client.dll 0x6fb092c1..0x6fb0933b & 0x6fb097fb:
    // Changing offered gold unchecks selfAccepted (0x4F 0x07) and sends 0x4F 0x08 (TRADEBTN_SENDGOLD).
    const emitTradeBtn = (btnId: number, val: number) => {
      if (typeof (hud.worldPanels as any).onTradeButtonClick === 'function') {
        ;(hud.worldPanels as any).onTradeButtonClick(btnId, val)
      } else if (typeof hud.onTradeButtonClick === 'function') {
        hud.onTradeButtonClick(btnId, val)
      } else {
        const sink = requireHudSink(hud, 'confirmGoldDialog')
        sink.clickButton?.(btnId, val)
      }
    }
    if (hud.trade?.selfAccepted || hud.trade?.myAccepted) {
      emitTradeBtn(0x07, 0)
    }
    emitTradeBtn(0x08, amount)
    if (hud.trade) {
      hud.trade.selfGold = amount
      hud.trade.myGold = amount
      hud.trade.selfAccepted = false
      hud.trade.myAccepted = false
    }
  } else if (amount > 0) {
    const sink = requireHudSink(hud, 'confirmGoldDialog')
    if (dlg.mode === 0) sink.dropGold(amount)
    else if (dlg.mode === 3) sink.depositGold(amount)
    else sink.withdrawGold(amount)
  }
  hud.syncPublishedState()
}

export function cancelGoldDialog(hud: HudManager): void {
  hud.goldDialog = null
  hud.syncPublishedState()
}

/** Gold dialog box (centered stone box: title, amount, ok / cancel). */
export function getGoldDialogLayout(hud: HudManager): GoldDialogLayout {
  const w = 260
  const h = 110
  const x = Math.round(hud.screenWidth / 2 - w / 2)
  const y = Math.round((hud.screenHeight - 47) / 2 - h / 2)
  return {
    x,
    y,
    w,
    h,
    ok: { x: x + 30, y: y + h - 34, w: 80, h: 22 },
    cancel: { x: x + w - 110, y: y + h - 34, w: 80, h: 22 },
  }
}

export function handleGoldDialogClick(hud: HudManager, x: number, y: number): void {
  const l = hud.getGoldDialogLayout()
  const inRect = (r: GoldDialogRect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  if (inRect(l.ok)) hud.confirmGoldDialog()
  else if (inRect(l.cancel)) hud.cancelGoldDialog()
}

export function drawGoldDialog(hud: HudManager, ctx: CanvasRenderingContext2D): void {
  const dlg = hud.goldDialog
  if (!dlg) return
  const l = hud.getGoldDialogLayout()
  const titleKey =
    dlg.mode === 0
      ? 'strDropGoldHowMuch'
      : dlg.mode === 2
        ? 'strTradeGoldHowMuch'
        : dlg.mode === 3
          ? 'strBankGoldDeposit'
          : 'strBankGoldWithdraw'
  const images = (hud as unknown as { images: Map<string, HTMLImageElement> }).images
  const boxPiecesImg = images.get('boxPieces') as HTMLImageElement | undefined
  if (boxPiecesImg) {
    drawStoneBoxFrame(ctx, l.x, l.y, l.w, l.h, boxPiecesImg)
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillRect(l.x, l.y, l.w, l.h)
    ctx.strokeStyle = '#6c5c40'
    ctx.strokeRect(l.x + 0.5, l.y + 0.5, l.w - 1, l.h - 1)
  }
  hud.font.drawText(ctx, requireTbl(titleKey, hud.lang), l.x + l.w / 2, l.y + 22, {
    font: 'font8',
    color: 'white',
    align: 'center',
  })
  hud.font.drawText(ctx, String(dlg.amount), l.x + l.w / 2, l.y + 50, {
    font: 'font16',
    color: 'gold',
    align: 'center',
  })
  for (const [rect, key] of [[l.ok, 'ok'], [l.cancel, 'lowercasecancel']] as const) {
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1)
    hud.font.drawText(ctx, requireTbl(key, hud.lang), rect.x + rect.w / 2, rect.y + 16, {
      font: 'font16',
      color: 'white',
      align: 'center',
    })
  }
}
