/**
 * Diablo II v1.13c HUD Input Router (`src/client/ui/hud-input-router.ts`).
 *
 * Extracted from `hud-manager.ts`:
 * - HUD mouse hit interception (`isPointInterceptedByHud`)
 * - Keyboard shortcuts & modal key routing (`handleHudKeyDown`)
 * - Window / Canvas DOM event binding & teardown (`bindHudWindowEvents`, `disposeHudWindowEvents`)
 * - HUD mouse move, press, and release routing (`handleHudMouseMove`, `handleHudMouseDown`, `handleHudMouseUp`)
 * - Vendor, inventory, paperdoll, and container grid click forwarding
 *   (`handleVendorInventoryClick`, `forwardInventoryPanelClick`, `forwardGridClick`)
 * - Skill allocation & 1.13c item/class UI sound helpers
 */

import { isPassiveSkill, isAuraSkill, isLeftUsableSkill } from './hotkeys.ts'
import { isAutoBeltablePotion } from './belt.ts'
import { STASH_GRID_ORIGIN, CUBE_GRID_ORIGIN } from './panels/panel-layout-constants.ts'
import type { MiniPanelAction } from './control-bar.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import { calculateManaCost } from '../../common/skills/skill-calc-engine.ts'
import { getSkillName } from '../../common/skills/skills-meta.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { imbueUiInventoryItem113c } from '../../common/items/item-bridge.ts'
import {
  type EquipSlotId,
  type UiInventoryItem,
  computeCursorItemGridPlacement,
  INV_GRID_ORIGIN,
  EQUIP_SLOTS_LAYOUT,
  WEAPON_SWAP_TABS_BOUNDS,
  isUsableRightClickItem,
  isSocketableUiItem,
  isScrollForTome,
  isUiItemUnidentified,
  canPlayerUseUiItem,
  isTwoHandedForClass,
  areHandSlotItemsCompatible,
  isItemAllowedInSlot,
} from './inventory.ts'
import type { BaseStatKey } from './character-sheet.ts'
import { isModalDomOverlayOpen } from './dom-overlay.ts'
import { isExtendedViewport } from '../view/viewport-profile.ts'
import { getSoundIdByName113c } from '../../common/audio/sounds-113c.ts'
import { resolveItemDropSoundId113c } from '../audio/item-drop-sound-113c.ts'
import {
  toControlBarLocal,
  toLeftDockLocal,
  fromLeftDockLocal,
  toRightDockLocal,
  fromRightDockLocal,
} from './hud-viewport-layout.ts'
import {
  handleEscapeSubmenuKeyDown,
  handleEscapeSubmenuMouseMove,
  handleEscapeSubmenuMouseUp,
  hitTestEscapeMenu,
} from './world-panels.ts'
import { matchesKeyBinding } from '../settings/client-settings.ts'
import { serverItemIdOf, type HudCommandSink, type HudManager } from './hud-manager.ts'

/** 1.13c class cantuseyet sound IDs (D2Client.dll 0x6fb46110 -> 0x6fad3200 code 20). */
export const CLASS_CODE_TO_CANTUSE_SOUND_ID: Readonly<Record<string, number>> = Object.freeze({
  ama: 2936,
  sor: 3248,
  nec: 3092,
  pal: 3170,
  bar: 3014,
  dru: 3404,
  ass: 3326,
})

/** 1.13c class cantcarry_1 sound IDs (D2Client.dll 0x6fb47141 -> 0x6fad3200 code 19). */
export const CLASS_CODE_TO_CANTCARRY_SOUND_ID: Readonly<Record<string, number>> = Object.freeze({
  ama: 2934,
  sor: 3246,
  nec: 3090,
  pal: 3168,
  bar: 3012,
  dru: 3402,
  ass: 3324,
})

export function playHudCantUseSound(hud: HudManager): void {
  const classCode = hud.inventory.playerContext.classCode ?? hud.currentClass ?? 'sor'
  const soundId = CLASS_CODE_TO_CANTUSE_SOUND_ID[classCode] ?? 3248
  hud.onPlayUiSound?.(soundId)
}

export function playHudCantCarrySound(hud: HudManager): void {
  const classCode = hud.inventory.playerContext.classCode ?? hud.currentClass ?? 'sor'
  const soundId = CLASS_CODE_TO_CANTCARRY_SOUND_ID[classCode] ?? 3246
  hud.onPlayUiSound?.(soundId)
}

/** D2Client.dll 0x6fb31e40: play item dropsound when placing/equipping an item in a container/slot. */
export function playHudItemDropUiSound(hud: HudManager, item: UiInventoryItem | null | undefined): void {
  if (!item || !hud.onPlayUiSound) return
  const id = resolveItemDropSoundId113c(item as { code?: string; dropSound?: string })
  if (id > 0) hud.onPlayUiSound(id)
}

/** D2Client.dll 0x6fb31d70: play item usesound when using an item (potion drink / scroll / tome). */
export function playHudItemUseUiSound(
  hud: HudManager,
  itemOrCode: UiInventoryItem | string | null | undefined,
): void {
  if (!itemOrCode || !hud.onPlayUiSound) return
  const code = (typeof itemOrCode === 'string' ? itemOrCode : (itemOrCode.code ?? '')).trim().toLowerCase()
  if (!code) return
  let soundName: string | undefined
  try {
    const tables = getEmbeddedDropTables() as any
    const base =
      typeof tables.getBase === 'function'
        ? tables.getBase(code)
        : (tables.weapons?.get(code) ?? tables.armor?.get(code) ?? tables.misc?.get(code))
    soundName = base?.usesound
  } catch {
    // ignore
  }
  const id = getSoundIdByName113c(soundName ?? '') ?? 0
  if (id > 0) hud.onPlayUiSound(id)
}

export function handleHudMouseMove(hud: HudManager, logicalX: number, logicalY: number): void {
  ;(hud as any).syncResolutionMode()
  hud.mouseX = logicalX
  hud.mouseY = logicalY
  hud.cursor.handleMouseMove(logicalX, logicalY)
  if (hud.worldPanels.escapeMenuOpen) {
    if (hud.worldPanels.escapeMenuScreen !== 'main') {
      const prevSel = hud.worldPanels.optionsSubmenuSelectedIndex
      const changed = handleEscapeSubmenuMouseMove(
        hud.worldPanels,
        logicalX,
        logicalY,
        hud.viewportProfile.width,
        hud.viewportProfile.height,
      )
      if (changed || hud.worldPanels.optionsSubmenuSelectedIndex !== prevSel) {
        hud.syncPublishedState()
      }
      return
    }
    // 1.13c D2Client.dll gmenu.cpp 0x6fb1528a..0x6fb152d4 -> 0x6fb14080:
    // Moving the cursor over an Escape menu row updates g_nEscMenuSelectedRow (0x6fbcc058)
    // so the flanking spinning pentagrams (CURSOR\Pentspin.dc6) track the hovered row.
    const hoveredRow = hitTestEscapeMenu(
      logicalX,
      logicalY,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
    if (hoveredRow !== null && hud.worldPanels.escapeMenuSelectedIndex !== hoveredRow) {
      hud.worldPanels.escapeMenuSelectedIndex = hoveredRow
      hud.syncPublishedState()
    }
    return
  }
  const docking = hud.getDockingLayout()
  const barPt = toControlBarLocal(logicalX, logicalY, docking)
  hud.globes.handleMouseMove(barPt.x, barPt.y)
  hud.belt.handleMouseMove(barPt.x, barPt.y)
  hud.hotkeys.handleMouseMove(barPt.x, barPt.y)
  hud.controlBar.handleMouseMove(barPt.x, barPt.y, {
    unspentStatPoints: hud.charSheet.attrs.statPoints,
    unspentSkillPoints: hud.skillTree.unspentSkillPoints,
  })
  if (hud.worldPanels.npcMenu) {
    hud.worldPanels.handleNpcMenuMove(
      logicalX,
      logicalY,
      hud.font,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
  }
  const rightPt = toRightDockLocal(logicalX, logicalY, docking)
  hud.inventory.handleMouseMove(rightPt.x, rightPt.y)
  if (hud.inventory.hoveredItem) {
    const tipPt = fromRightDockLocal(
      hud.inventory.hoveredItem.x,
      hud.inventory.hoveredItem.y,
      docking,
    )
    hud.inventory.hoveredItem.x = tipPt.x
    hud.inventory.hoveredItem.y = tipPt.y
  }
  hud.skillTree.handleMouseMove(rightPt.x, rightPt.y)
  if (hud.leftPanel === 'char') {
    const leftPt = toLeftDockLocal(logicalX, logicalY, docking)
    hud.charSheet.handleMouseMove(leftPt.x, leftPt.y)
  } else {
    hud.charSheet.hoveredStat = null
    hud.charSheet.hoveredDamageHand = null
  }
  if (hud.leftPanel === 'hire') {
    hud.worldPanels.handleHireMercMove(
      logicalX,
      logicalY,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
  } else if (hud.leftPanel === 'msg') {
    hud.worldPanels.handleMouseMove(logicalX, logicalY)
  } else if (hud.leftPanel !== 'none' && hud.leftPanel !== 'char') {
    const leftPt = toLeftDockLocal(logicalX, logicalY, docking)
    hud.worldPanels.handleMouseMove(leftPt.x, leftPt.y)
    if (hud.leftPanel === 'stash' && hud.worldPanels.hoveredStashItem) {
      const tipPt = fromLeftDockLocal(
        hud.worldPanels.hoveredStashItem.x,
        hud.worldPanels.hoveredStashItem.y,
        docking,
      )
      hud.inventory.hoveredItem = {
        ...hud.worldPanels.hoveredStashItem,
        x: tipPt.x,
        y: tipPt.y,
      }
    } else if (hud.leftPanel === 'cube' && hud.worldPanels.hoveredCubeItem) {
      const tipPt = fromLeftDockLocal(
        hud.worldPanels.hoveredCubeItem.x,
        hud.worldPanels.hoveredCubeItem.y,
        docking,
      )
      hud.inventory.hoveredItem = {
        ...hud.worldPanels.hoveredCubeItem,
        x: tipPt.x,
        y: tipPt.y,
      }
    } else if (hud.leftPanel === 'vendor' && hud.worldPanels.hoveredVendorItem) {
      const tipPt = fromLeftDockLocal(
        hud.worldPanels.hoveredVendorItem.x,
        hud.worldPanels.hoveredVendorItem.y,
        docking,
      )
      hud.inventory.hoveredItem = {
        item: hud.worldPanels.hoveredVendorItem.item,
        x: tipPt.x,
        y: tipPt.y,
      }
    } else if (hud.leftPanel === 'merc' && hud.worldPanels.hoveredMercItem) {
      const tipPt = fromLeftDockLocal(
        hud.worldPanels.hoveredMercItem.x,
        hud.worldPanels.hoveredMercItem.y,
        docking,
      )
      hud.inventory.hoveredItem = {
        ...hud.worldPanels.hoveredMercItem,
        x: tipPt.x,
        y: tipPt.y,
      }
    } else if (hud.leftPanel === 'trade' && hud.worldPanels.hoveredTradeItem) {
      const tipPt = fromLeftDockLocal(
        hud.worldPanels.hoveredTradeItem.x,
        hud.worldPanels.hoveredTradeItem.y,
        docking,
      )
      hud.inventory.hoveredItem = {
        ...hud.worldPanels.hoveredTradeItem,
        x: tipPt.x,
        y: tipPt.y,
      }
    } else if (
      (hud.leftPanel === 'imbue' ||
        hud.leftPanel === 'add_sockets' ||
        hud.leftPanel === 'personalize' ||
        hud.leftPanel === 'orifice') &&
      hud.worldPanels.hoveredQuestRewardItem
    ) {
      const tipPt = fromLeftDockLocal(
        hud.worldPanels.hoveredQuestRewardItem.x,
        hud.worldPanels.hoveredQuestRewardItem.y,
        docking,
      )
      hud.inventory.hoveredItem = {
        ...hud.worldPanels.hoveredQuestRewardItem,
        x: tipPt.x,
        y: tipPt.y,
      }
    }
  }
}

/**
 * Whether a logical `(x, y)` point hits an active HUD panel or control bar,
 * so scene clicks/walks underneath are suppressed.
 */
export function isPointInterceptedByHud(hud: HudManager, logicalX: number, logicalY: number): boolean {
  if (
    hud.isDead ||
    Boolean((hud.worldPanels as any).isDead) ||
    hud.goldDialog ||
    hud.worldPanels.escapeMenuOpen
  ) {
    return true
  }
  const is640: boolean = (hud as any).syncResolutionMode()
  const profile = hud.viewportProfile
  const docking = hud.getDockingLayout()
  const { marginW } = docking

  if (isExtendedViewport(profile)) {
    if (logicalX < -marginW || logicalX > profile.width + marginW || logicalY < 0 || logicalY > profile.height) {
      return false
    }
    if (hud.worldPanels.isPointInNpcMenu(logicalX, logicalY, hud.font, profile.width, profile.height)) return true
    if (hud.worldPanels.isPointInHireMercDialog(logicalX, logicalY, profile.width, profile.height)) return true
    if (
      hud.leftPanel === 'msg' &&
      logicalX >= 5 &&
      logicalX <= profile.width - 15 &&
      logicalY >= 30 &&
      logicalY <= profile.height - 100
    ) {
      return true
    }
    if (hud.hitTestQuestAlert(logicalX, logicalY)) return true
    if (hud.isPointInMercPortrait(logicalX, logicalY)) return true
    const barX = logicalX - profile.barOffsetX
    const barY = logicalY - profile.barOffsetY
    if (barY >= 540 && barY <= 600 && barX >= 0 && barX <= 800) return true
    if (barX >= 0 && barX <= 117 && barY >= 496 && barY <= 600) return true
    if (barX >= 683 && barX <= 800 && barY >= 496 && barY <= 600) return true
    if (hud.controlBar.miniPanelOpen && barX >= 312 && barX <= 488 && barY >= 522 && barY <= 600) return true
    if (hud.belt.isExpanded && barX >= 420 && barX <= 550 && barY >= 460 && barY <= 600) return true
    if (hud.hotkeys.openPopup !== null) return true
    const panelY = logicalY - profile.panelOffsetY
    if (
      hud.leftPanel !== 'none' &&
      hud.leftPanel !== 'hire' &&
      hud.leftPanel !== 'msg' &&
      logicalX >= 0 &&
      logicalX <= 400 &&
      panelY >= 0 &&
      panelY <= 553
    ) {
      return true
    }
    const rightDockX = profile.width - 400
    if (hud.rightPanel !== 'none' && logicalX >= rightDockX && logicalX <= profile.width && panelY >= 0 && panelY <= 553) {
      return true
    }
    return false
  }

  if (is640) {
    if (logicalX < 0 || logicalX > 640 || logicalY < 0 || logicalY > 480) return false
    if (hud.worldPanels.isPointInNpcMenu(logicalX, logicalY, hud.font, 640, 480)) return true
    if (hud.worldPanels.isPointInHireMercDialog(logicalX, logicalY, 640, 480)) return true
    if (hud.leftPanel === 'msg' && logicalX >= 5 && logicalX <= 625 && logicalY >= 30 && logicalY <= 380) return true
    if (hud.hitTestQuestAlert(logicalX, logicalY)) return true
    if (hud.isPointInMercPortrait(logicalX, logicalY)) return true
    if (logicalY >= 432 && logicalY <= 480 && logicalX >= 0 && logicalX <= 640) return true
    if (logicalX >= 0 && logicalX <= 117 && logicalY >= 376 && logicalY <= 480) return true
    if (logicalX >= 523 && logicalX <= 640 && logicalY >= 376 && logicalY <= 480) return true
    const mpBounds = hud.controlBar.currentMiniPanelBounds
    if (
      hud.controlBar.miniPanelOpen &&
      logicalX >= mpBounds.x &&
      logicalX <= mpBounds.x + mpBounds.width &&
      logicalY >= mpBounds.y &&
      logicalY <= 480
    ) {
      return true
    }
    if (hud.belt.isExpanded && logicalX >= 340 && logicalX <= 470 && logicalY >= 340 && logicalY <= 480) return true
    if (hud.hotkeys.openPopup !== null) return true
    if (
      hud.leftPanel !== 'none' &&
      hud.leftPanel !== 'msg' &&
      logicalX >= 0 &&
      logicalX <= 320 &&
      logicalY >= 0 &&
      logicalY <= 432
    ) {
      return true
    }
    if (hud.rightPanel !== 'none' && logicalX >= 320 && logicalX <= 640 && logicalY >= 0 && logicalY <= 432) return true
    return false
  }

  if (logicalX < 0 || logicalX > 800 || logicalY < 0 || logicalY > 600) return false
  if (hud.worldPanels.isPointInNpcMenu(logicalX, logicalY, hud.font, profile.width, profile.height)) return true
  if (hud.worldPanels.isPointInHireMercDialog(logicalX, logicalY, profile.width, profile.height)) return true
  if (
    hud.leftPanel === 'msg' &&
    logicalX >= 5 &&
    logicalX <= profile.width - 15 &&
    logicalY >= 30 &&
    logicalY <= profile.height - 100
  ) {
    return true
  }
  if (hud.hitTestQuestAlert(logicalX, logicalY)) return true
  if (hud.isPointInMercPortrait(logicalX, logicalY)) return true
  if (logicalY >= 540 && logicalX >= 0 && logicalX <= 800) return true
  if (logicalX >= 0 && logicalX <= 117 && logicalY >= 496) return true
  if (logicalX >= 683 && logicalX <= 800 && logicalY >= 496) return true
  if (hud.controlBar.miniPanelOpen && logicalX >= 312 && logicalX <= 488 && logicalY >= 522) return true
  if (hud.belt.isExpanded && logicalX >= 420 && logicalX <= 550 && logicalY >= 460) return true
  if (hud.hotkeys.openPopup !== null) return true
  if (
    hud.leftPanel !== 'none' &&
    hud.leftPanel !== 'hire' &&
    hud.leftPanel !== 'msg' &&
    logicalX >= 0 &&
    logicalX <= 400 &&
    logicalY >= 0 &&
    logicalY <= 553
  ) {
    return true
  }
  if (hud.rightPanel !== 'none' && logicalX >= 400 && logicalX <= 800 && logicalY >= 0 && logicalY <= 553) return true
  return false
}

export function drinkHudBeltSlot(hud: HudManager, col: number, shiftToMerc = false): boolean {
  const slotCol = col >= 0 && col < 16 ? col % 4 : col
  const slotRow = col >= 0 && col < 16 ? Math.floor(col / 4) : 0
  let potion = hud.belt.getSlot(slotCol, slotRow)
  // Column hotkeys (`1..4` -> slot 0..3) drink the lowest occupied row of that column
  // (mirrors `useBeltSlotImpl`), so pick the same potion for its usesound.
  for (let r = 1; !potion && col >= 0 && col < 4 && r < 4; r++) {
    potion = hud.belt.getSlot(slotCol, r)
  }
  const code = (potion?.code ?? '').trim().toLowerCase()
  const isMercConsumable = code.length > 0 && /^(hp[1-5]|hpo|hpf|rvs|rvl)$/.test(code)
  const mercClassId = (hud.merc as any)?.classId ?? (hud.merc as any)?.hcIdx ?? 0
  // Server authority: request `0x26 BeltUse`; healing and belt contents come back from the server.
  if (hud.commandSink) {
    if (shiftToMerc && potion && !isMercConsumable && (hud.commandSink as any).world === undefined) {
      const cantUseSoundId = mercClassId === 271 ? 4612 : 4616
      hud.onPlayUiSound?.(cantUseSoundId)
      return false
    }
    const ok = hud.commandSink.onUseBeltSlot
      ? hud.commandSink.onUseBeltSlot(col, shiftToMerc) !== false
      : hud.commandSink.useBeltSlot(col, shiftToMerc)
    if (ok && potion) {
      ;(hud as any).playItemUseUiSound(potion.code ?? 'hp1')
    }
    return ok
  }
  if (!potion) return false
  if (shiftToMerc) {
    if (!isMercConsumable) {
      const cantUseSoundId = mercClassId === 271 ? 4612 : 4616
      hud.onPlayUiSound?.(cantUseSoundId)
      return false
    }
    if (!hud.merc || hud.merc.isDead) {
      return false
    }
    hud.belt.useSlot(slotCol, slotRow)
    ;(hud as any).playItemUseUiSound(potion.code ?? 'hp1')
    const thanksSoundId = mercClassId === 271 ? 4615 : 4625
    hud.onPlayUiSound?.(thanksSoundId)
    hud.syncPublishedState()
    return true
  }
  hud.belt.useSlot(slotCol, slotRow)
  ;(hud as any).playItemUseUiSound(potion.code ?? 'hp1')
  hud.syncPublishedState()
  return true
}

export function triggerHudResurrect(hud: HudManager): void {
  const sink = hud.commandSink
  if (sink?.onResurrect) {
    sink.onResurrect()
  } else if (sink?.resurrect) {
    sink.resurrect()
  } else {
    ;(hud.worldPanels as any).onResurrect?.()
  }
}

export function handleHudKeyDown(
  hud: HudManager,
  rawEvent: KeyboardEvent | { key: string; preventDefault?: () => void; target?: any } | string,
): void {
  const e: KeyboardEvent =
    typeof rawEvent === 'string'
      ? ({ key: rawEvent } as KeyboardEvent)
      : (rawEvent as KeyboardEvent)
  if (
    (e as { _d2HandledByCommandMapper?: boolean; _d2KeyHandled?: boolean })?._d2HandledByCommandMapper ||
    (e as { _d2HandledByCommandMapper?: boolean; _d2KeyHandled?: boolean })?._d2KeyHandled
  ) {
    return
  }
  if (isModalDomOverlayOpen()) {
    return
  }
  if (
    typeof HTMLInputElement !== 'undefined' &&
    (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)
  ) {
    return
  }
  if ((hud.isDead || Boolean((hud.worldPanels as any).isDead)) && e.key === 'Escape') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).triggerResurrect()
    return
  }
  if (hud.goldDialog) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    if (e.key === 'Enter') hud.confirmGoldDialog()
    else if (e.key === 'Escape') hud.cancelGoldDialog()
    else hud.typeGoldDialogKey(e.key)
    hud.syncPublishedState()
    return
  }
  if (
    hud.worldPanels.npcMenu?.talking ||
    (!hud.worldPanels.npcMenu && hud.worldPanels.npcSpeech !== null)
  ) {
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Escape' ||
      e.key === ' ' ||
      e.key === 'Space' ||
      e.key === 'Spacebar' ||
      e.key === 'Enter'
    ) {
      if (hud.worldPanels.handleNpcSpeechKeyDown(e.key)) {
        e.preventDefault?.()
        ;(e as any)._d2KeyHandled = true
        hud.syncPublishedState()
        return
      }
    }
  }
  if (hud.worldPanels.escapeMenuOpen) {
    ;(e as any)._d2KeyHandled = true
    if (hud.worldPanels.escapeMenuScreen !== 'main') {
      handleEscapeSubmenuKeyDown(hud.worldPanels, e)
      hud.onPlayUiSound?.(2)
      hud.syncPublishedState()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault?.()
      hud.toggleEscapeMenu()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.()
      hud.moveEscapeMenuSelection(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault?.()
      hud.moveEscapeMenuSelection(1)
    } else if (e.key === 'Enter') {
      e.preventDefault?.()
      hud.activateEscapeMenuIndex()
    }
    return
  }
  const key = e.key.toUpperCase()
  const callbacks = (hud as any).callbacks
  const kb = hud.getActiveKeyBindings()

  if (matchesKeyBinding(kb, 'inventoryScreen', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleRightPanel('inv')
  } else if (matchesKeyBinding(kb, 'characterScreen', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleLeftPanel('char')
  } else if (matchesKeyBinding(kb, 'hirelingScreen', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    if (hud.merc && !hud.merc.isDead) {
      hud.toggleLeftPanel('merc')
    }
  } else if (matchesKeyBinding(kb, 'partyScreen', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleLeftPanel('party')
  } else if (matchesKeyBinding(kb, 'messageLog', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleLeftPanel('msg')
  } else if (matchesKeyBinding(kb, 'skillTree', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleRightPanel('skill')
  } else if (matchesKeyBinding(kb, 'skillSpeedBar', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.hotkeys.openPopup = hud.hotkeys.openPopup ? null : 'right'
    hud.syncPublishedState()
  } else if (matchesKeyBinding(kb, 'questLog', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleLeftPanel('quest')
  } else if (key === 'Z') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.togglePartyPortraits()
  } else if (matchesKeyBinding(kb, 'helpScreen', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.toggleHelpOverlay()
  } else if (key === 'N') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.chatOverlayMessages = []
    hud.syncPublishedState()
  } else if (matchesKeyBinding(kb, 'toggleMiniMap', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    if (typeof (hud as any).onToggleAutomapMode === 'function') {
      ;(hud as any).onToggleAutomapMode()
    } else if (callbacks.onToggleAutomapMode) {
      callbacks.onToggleAutomapMode()
    } else if (!hud.commandSink) {
      hud.toggleLeftPanel('waypoint')
    }
  } else if (matchesKeyBinding(kb, 'centerAutomap', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onAutomapCenter?.() ??
      (hud as any).onResetAutomapPan?.() ??
      callbacks.onResetAutomapPan?.()
  } else if (matchesKeyBinding(kb, 'fadeAutomap', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onCycleAutomapFade?.() ?? callbacks.onCycleAutomapFade?.()
  } else if (matchesKeyBinding(kb, 'partyOnAutomap', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onToggleAutomapParty?.() ?? callbacks.onToggleAutomapParty?.()
  } else if (matchesKeyBinding(kb, 'namesOnAutomap', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onToggleAutomapNames?.() ?? callbacks.onToggleAutomapNames?.()
  } else if (key === 'F9') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onCycleAutomapFade?.() ?? callbacks.onCycleAutomapFade?.()
  } else if (key === 'F10') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onToggleAutomapNames?.() ?? callbacks.onToggleAutomapNames?.()
  } else if (key === 'F11') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onToggleAutomapParty?.() ?? callbacks.onToggleAutomapParty?.()
  } else if (key === 'F12') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onToggleAutomapNames?.() ?? callbacks.onToggleAutomapNames?.()
  } else if (e.key === 'Home') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    ;(hud as any).onAutomapCenter?.() ??
      (hud as any).onResetAutomapPan?.() ??
      callbacks.onResetAutomapPan?.()
  } else if (
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight'
  ) {
    const dx = e.key === 'ArrowLeft' ? -8 : e.key === 'ArrowRight' ? 8 : 0
    const dy = e.key === 'ArrowUp' ? -8 : e.key === 'ArrowDown' ? 8 : 0
    if (callbacks.onPanAutomap?.(dx, dy)) {
      e.preventDefault?.()
      ;(e as any)._d2KeyHandled = true
    }
  } else if (matchesKeyBinding(kb, 'swapWeapons', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    if (hud.commandSink) {
      hud.commandSink.swapWeapons()
    } else if (hud.onWeaponSwitch) {
      hud.onWeaponSwitch()
    } else {
      hud.inventory.toggleWeaponSwap()
    }
    hud.syncPublishedState()
  } else if (matchesKeyBinding(kb, 'toggleRunWalk', e)) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.isRunning = !hud.isRunning
    hud.syncPublishedState()
  } else if (matchesKeyBinding(kb, 'showBelt', e) || e.key === '`' || e.key === '~') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.belt.togglePopup()
    hud.syncPublishedState()
  } else if (
    matchesKeyBinding(kb, 'useBeltSlot1', e) ||
    matchesKeyBinding(kb, 'useBeltSlot2', e) ||
    matchesKeyBinding(kb, 'useBeltSlot3', e) ||
    matchesKeyBinding(kb, 'useBeltSlot4', e) ||
    e.key === '!' ||
    e.key === '@' ||
    e.key === '#' ||
    e.key === '$'
  ) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    const slotIndex =
      matchesKeyBinding(kb, 'useBeltSlot1', e) || e.key === '!'
        ? 0
        : matchesKeyBinding(kb, 'useBeltSlot2', e) || e.key === '@'
          ? 1
          : matchesKeyBinding(kb, 'useBeltSlot3', e) || e.key === '#'
            ? 2
            : 3
    const isShiftedKey =
      Boolean(e.shiftKey) || e.key === '!' || e.key === '@' || e.key === '#' || e.key === '$'
    hud.drinkBeltSlot(slotIndex, isShiftedKey)
  } else if (
    matchesKeyBinding(kb, 'selectSkill1', e) ||
    matchesKeyBinding(kb, 'selectSkill2', e) ||
    matchesKeyBinding(kb, 'selectSkill3', e) ||
    matchesKeyBinding(kb, 'selectSkill4', e) ||
    matchesKeyBinding(kb, 'selectSkill5', e) ||
    matchesKeyBinding(kb, 'selectSkill6', e) ||
    matchesKeyBinding(kb, 'selectSkill7', e) ||
    matchesKeyBinding(kb, 'selectSkill8', e) ||
    /^(?:F[1-8]|SKILL(?:9|1[0-6]))$/.test(key)
  ) {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    const fnKey = matchesKeyBinding(kb, 'selectSkill1', e)
      ? 'F1'
      : matchesKeyBinding(kb, 'selectSkill2', e)
        ? 'F2'
        : matchesKeyBinding(kb, 'selectSkill3', e)
          ? 'F3'
          : matchesKeyBinding(kb, 'selectSkill4', e)
            ? 'F4'
            : matchesKeyBinding(kb, 'selectSkill5', e)
              ? 'F5'
              : matchesKeyBinding(kb, 'selectSkill6', e)
                ? 'F6'
                : matchesKeyBinding(kb, 'selectSkill7', e)
                  ? 'F7'
                  : matchesKeyBinding(kb, 'selectSkill8', e)
                    ? 'F8'
                    : key
    hud.hotkeys.triggerFunctionKey(fnKey)
    hud.syncPublishedState()
  } else if (matchesKeyBinding(kb, 'showItems', e) || e.key === 'Alt') {
    e.preventDefault?.()
    ;(e as any)._d2KeyHandled = true
    hud.showGroundLabels = true
    hud.syncPublishedState()
  } else if (e.key === 'Escape' || matchesKeyBinding(kb, 'clearScreen', e) || e.code === 'Space' || e.key === ' ') {
    const isSpace = matchesKeyBinding(kb, 'clearScreen', e) || e.code === 'Space' || e.key === ' '
    const closed = hud.closeAllPanels()
    if (isSpace) {
      ;(hud as any).onAutomapCenter?.() ??
        (hud as any).onResetAutomapPan?.() ??
        callbacks.onResetAutomapPan?.()
    }
    if (closed || isSpace) {
      e.preventDefault?.()
      ;(e as any)._d2KeyHandled = true
    }
  }
}

export function bindHudWindowEvents(hud: HudManager): void {
  const internal = hud as unknown as {
    eventsBound: boolean
    boundWindowEvents: [
      Window | HTMLCanvasElement,
      string,
      EventListener,
      (boolean | AddEventListenerOptions | undefined)?,
    ][]
    hudCanvas: HTMLCanvasElement
    invalidateCanvasRectCache: () => void
  }
  if (internal.eventsBound || typeof window === 'undefined') return
  internal.eventsBound = true

  // #954: every handler is registered through `boundWindowEvents` so
  // `dispose()` can remove them all.
  const on = (
    target: Window | HTMLCanvasElement,
    type: string,
    fn: (e: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, fn as EventListener, options)
    internal.boundWindowEvents.push([target, type, fn as EventListener, options])
  }

  on(window, 'resize', () => internal.invalidateCanvasRectCache())

  on(window, 'keydown', (e) => hud.handleKeyDown(e as KeyboardEvent))

  on(window, 'keyup', (e) => {
    if (isModalDomOverlayOpen()) return
    const ke = e as KeyboardEvent
    if (matchesKeyBinding(hud.getActiveKeyBindings(), 'showItems', ke) || ke.key === 'Alt') {
      e.preventDefault()
      hud.showGroundLabels = false
      hud.syncPublishedState()
    }
  })

  on(window, 'blur', () => {
    if (hud.showGroundLabels) {
      hud.showGroundLabels = false
      hud.syncPublishedState()
    }
  })

  on(window, 'mousemove', (e) => {
    const pt = hud.clientToLogical((e as MouseEvent).clientX, (e as MouseEvent).clientY)
    hud.handleMouseMove(pt.x, pt.y)

    const intercept =
      hud.isPointInterceptedByHud(hud.mouseX, hud.mouseY) ||
      hud.inventory.cursorItem !== null ||
      hud.worldPanels.vendorTradeState !== 'idle' ||
      hud.inventory.isIdentifyMode() ||
      hud.pendingIdentifyScrollId !== null
    internal.hudCanvas.style.pointerEvents = intercept ? 'auto' : 'none'
  })

  on(window, 'mousedown', (e) => {
    hud.cursor.handleMouseDown()
    if (e.defaultPrevented) return
    if ((e as { _d2HandledByCommandMapper?: boolean })._d2HandledByCommandMapper) return
    if (
      e.target !== internal.hudCanvas &&
      typeof HTMLCanvasElement !== 'undefined' &&
      e.target instanceof HTMLCanvasElement
    ) {
      hud.handleHudMouseDown(e as MouseEvent)
    }
  })

  on(window, 'mouseup', (e) => {
    hud.cursor.handleMouseUp()
    const pt = hud.clientToLogical((e as MouseEvent).clientX, (e as MouseEvent).clientY)
    // `handleHudMouseUp` first: a latched panel close `X` must fire on this release
    // before `releaseMomentaryVendorButton` pops the vendor/cube pressed cells.
    hud.handleHudMouseUp(pt.x, pt.y, (e as MouseEvent).button)
    hud.worldPanels.releaseMomentaryVendorButton()
  })

  on(
    window,
    'wheel',
    (e) => {
      if ((e as { _d2WheelHandled?: boolean })._d2WheelHandled) return
      const we = e as WheelEvent
      if (hud.leftPanel === 'msg') {
        const pt = hud.clientToLogical(we.clientX, we.clientY)
        if (
          pt.x >= 5 &&
          pt.x <= hud.viewportProfile.width - 15 &&
          pt.y >= 30 &&
          pt.y <= hud.viewportProfile.height - 100
        ) {
          hud.worldPanels.scrollMessageLog(we.deltaY < 0 ? 2 : -2)
          ;(e as { _d2WheelHandled?: boolean })._d2WheelHandled = true
          we.preventDefault()
          return
        }
      }
      if (hud.handleWheel(we.deltaY)) {
        ;(e as { _d2WheelHandled?: boolean })._d2WheelHandled = true
        we.preventDefault()
      }
    },
    { passive: false },
  )

  on(internal.hudCanvas, 'contextmenu', (e) => {
    e.preventDefault()
  })

  on(internal.hudCanvas, 'mousedown', (e) => hud.handleHudMouseDown(e as MouseEvent))
}

export function disposeHudWindowEvents(hud: HudManager): void {
  const internal = hud as unknown as {
    eventsBound: boolean
    boundWindowEvents: [
      Window | HTMLCanvasElement,
      string,
      EventListener,
      (boolean | AddEventListenerOptions | undefined)?,
    ][]
  }
  for (const [target, type, fn, options] of internal.boundWindowEvents) {
    target.removeEventListener(type, fn, options)
  }
  internal.boundWindowEvents.length = 0
  internal.eventsBound = false
  hud.setCursorLayerActive(false)
}

export function handleHudMouseUp(hud: HudManager, logicalX: number, logicalY: number, button = 0): void {
  if (button === 0 && hud.questAlert) {
    const inside = hud.hitTestQuestAlert(logicalX, logicalY)
    if (hud.questAlert.releaseAlert(inside)) {
      hud.openLeftPanel('quest')
    }
  }
  if (button !== 0) return

  if (hud.worldPanels.escapeMenuOpen && hud.worldPanels.escapeMenuScreen !== 'main') {
    const subUp = handleEscapeSubmenuMouseUp(
      hud.worldPanels,
      logicalX,
      logicalY,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
    if (subUp) {
      hud.onPlayUiSound?.(4)
      hud.syncPublishedState()
      return
    }
  }

  // 1.13c bar buttons fire on mouse-up inside the pressed element; dragging off the
  // button and releasing cancels (ControlBarHud / CharacterSheetPanel latch on mousedown).
  ;(hud as any).syncResolutionMode()
  const docking = hud.getDockingLayout()
  const barPt = toControlBarLocal(logicalX, logicalY, docking)
  if (hud.controlBar.handleMouseUp(barPt.x, barPt.y, (hud as any).controlBarReleaseCallbacks())) {
    hud.onPlayUiSound?.(4)
    hud.syncPublishedState()
  }
  // World-panel close `X` buttons (quest / cube / vendor slot / stash / waypoint /
  // merc / trade-family panels): the press latched the depressed cell in
  // `WorldPanels`, the close fires only when the release lands back on it.
  const closeLeftPt = toLeftDockLocal(logicalX, logicalY, docking)
  if (hud.worldPanels.releaseCloseButton(closeLeftPt.x, closeLeftPt.y, logicalX, logicalY)) {
    hud.onPlayUiSound?.(4)
    if (hud.leftPanel !== 'none' && hud.worldPanels.activePanel === 'none') {
      hud.leftPanel = 'none'
    }
    hud.syncPublishedState()
  }
  // Waypoint rows share the same 1.13c semantics: the press latched the depressed
  // icon; the teleport fires only when the release lands back on the same row.
  if (hud.worldPanels.releaseWaypointButton(closeLeftPt.x, closeLeftPt.y)) {
    if (hud.leftPanel !== 'none' && hud.worldPanels.activePanel === 'none') {
      hud.leftPanel = 'none'
    }
    hud.syncPublishedState()
  }
  if (hud.leftPanel === 'char') {
    const leftPt = toLeftDockLocal(logicalX, logicalY, docking)
    if (
      hud.charSheet.handleMouseUp(leftPt.x, leftPt.y, (key: BaseStatKey) => {
        hud.commandSink?.allocateStat(key)
      })
    ) {
      hud.onPlayUiSound?.(4)
      if (!hud.charSheet.visible) hud.leftPanel = 'none'
      hud.syncPublishedState()
    }
  }
  // Right-dock panel close `X` buttons (inventory / skill tree): the press latched
  // the depressed `buysellbtn.dc6` cell, the panel closes only when the release
  // lands back on the same button.
  if (hud.rightPanel === 'inv' || hud.rightPanel === 'skill') {
    const rightPt = toRightDockLocal(logicalX, logicalY, docking)
    const fired =
      hud.rightPanel === 'inv'
        ? hud.inventory.handleMouseUp(rightPt.x, rightPt.y)
        : hud.skillTree.handleMouseUp(rightPt.x, rightPt.y)
    if (fired) {
      hud.onPlayUiSound?.(4)
      if (!hud.inventory.visible && hud.rightPanel === 'inv') hud.rightPanel = 'none'
      if (!hud.skillTree.visible && hud.rightPanel === 'skill') hud.rightPanel = 'none'
      hud.syncPublishedState()
    }
  }
}

export function createControlBarReleaseCallbacks(hud: HudManager): {
  onToggleRun: () => void
  onMiniPanelAction: (action: MiniPanelAction) => void
} {
  const callbacks = (hud as any).callbacks
  return {
    onToggleRun: () => {
      hud.isRunning = !hud.isRunning
    },
    onMiniPanelAction: (action: MiniPanelAction) => {
      if (action === 'char') hud.toggleLeftPanel('char')
      else if (action === 'inv') hud.toggleRightPanel('inv')
      else if (action === 'skill') hud.toggleRightPanel('skill')
      else if (action === 'party') hud.toggleLeftPanel('party')
      else if (action === 'automap') callbacks.onToggleAutomap()
      else if (action === 'msg') callbacks.onToggleMessageLog?.() ?? hud.toggleLeftPanel('msg' as any)
      else if (action === 'quest') hud.toggleLeftPanel('quest')
      else if (action === 'menu') hud.toggleEscapeMenu()
    },
  }
}

export function handleHudMouseDown(
  hud: HudManager,
  eOrX: MouseEvent | number,
  logicalY?: number,
  _viewportW?: number,
  _viewportH?: number,
): void {
  if (typeof eOrX === 'number') {
    hud.handleClick(eOrX, logicalY ?? 0, 0)
    return
  }
  const e = eOrX as MouseEvent & { _logicalX?: number; _logicalY?: number }
  if (e.defaultPrevented) return
  if (e.button !== 0 && e.button !== 2) return
  const pt =
    typeof e._logicalX === 'number' && typeof e._logicalY === 'number'
      ? { x: e._logicalX, y: e._logicalY }
      : hud.clientToLogical(e.clientX, e.clientY)
  if (hud.isDead || Boolean((hud.worldPanels as any).isDead)) {
    e.preventDefault?.()
    e.stopPropagation?.()
    ;(hud as any).triggerResurrect()
    return
  }
  if (hud.goldDialog) {
    e.preventDefault()
    e.stopPropagation()
    if (e.button === 0) (hud as any).handleGoldDialogClick(pt.x, pt.y)
    return
  }
  if (hud.worldPanels.escapeMenuOpen) {
    e.preventDefault()
    e.stopPropagation()
    if (e.button === 0) hud.handleEscapeMenuClick(pt.x, pt.y)
    return
  }
  if (hud.questAlert) {
    if (e.button === 0 && hud.hitTestQuestAlert(pt.x, pt.y)) {
      e.preventDefault()
      e.stopPropagation()
      hud.questAlert.pressAlert(true)
      hud.onPlayUiSound?.(4)
      hud.syncPublishedState()
      return
    }
    hud.questAlert.pressAlert(false)
  }
  if (
    (hud.worldPanels.npcMenu || hud.worldPanels.npcSpeech !== null) &&
    !hud.worldPanels.isPointInNpcMenu(
      pt.x,
      pt.y,
      hud.font,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    ) &&
    !hud.worldPanels.isPointInHireMercDialog(
      pt.x,
      pt.y,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
  ) {
    if (hud.worldPanels.npcMenu?.talking || hud.worldPanels.npcSpeech !== null) {
      e.preventDefault()
      e.stopPropagation()
      hud.worldPanels.closeNpcSpeech()
      hud.syncPublishedState()
      return
    }
    hud.dismissNpcMenu()
  }
  const callbacks = (hud as any).callbacks
  if (!hud.isPointInterceptedByHud(pt.x, pt.y)) {
    if (hud.inventory.isIdentifyMode() || hud.pendingIdentifyScrollId !== null) {
      e.preventDefault()
      e.stopPropagation()
      hud.pendingIdentifyScrollId = null
      hud.inventory.cancelIdentifyMode()
      hud.syncPublishedState()
      return
    }
    if (hud.worldPanels.vendorTradeState !== 'idle') {
      e.preventDefault()
      e.stopPropagation()
      hud.worldPanels.vendorTradeState = 'idle'
      hud.syncPublishedState()
      return
    }
    // If holding cursorItem and clicking outside panels onto the ground, drop it
    if (hud.inventory.cursorItem !== null) {
      e.preventDefault()
      e.stopPropagation()
      const dropped = hud.inventory.cursorItem
      if (hud.commandSink) {
        hud.commandSink.dropItem(serverItemIdOf(dropped))
      } else {
        hud.inventory.cursorItem = null
        callbacks.onDropItemToGround?.(dropped, pt)
      }
      hud.syncPublishedState()
    }
    return
  }

  e.preventDefault()
  e.stopPropagation()

  const requireSink = (action: string): HudCommandSink => (hud as any).requireSink(action)

  // Town NPC Stone Menu / Standalone Speech click
  if (hud.worldPanels.npcMenu || hud.worldPanels.npcSpeech !== null) {
    const npcId = hud.worldPanels.npcMenu?.npcId ?? null
    hud.worldPanels.handleNpcMenuClick(
      pt.x,
      pt.y,
      {
        onOpenVendor: (_desc, mode) => {
          const sink = requireSink('npcMenu')
          if (npcId === null) throw new Error('HudManager: NPC menu has no server NPC id')
          if (mode === 'trade') sink.openNpcTrade(npcId)
          else sink.openNpcGamble(npcId)
        },
        onIdentifyAll: (_desc) => {
          const sink = requireSink('npcMenu')
          if (npcId === null) throw new Error('HudManager: NPC menu has no server NPC id')
          sink.identifyAllAtNpc(npcId)
        },
        onCancel: () => {
          if (npcId !== null) requireSink('npcMenu').closeNpc(npcId)
        },
      },
      hud.font,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
    hud.syncPublishedState()
    return
  }

  // 1.13c Hireables.cpp (0x6fb0b880 / 0x6fb0bcd0):
  // - right-click on top-left Mercenary portrait opens Mercenary screen
  // - left-click with a cursor item equips/gives the item to the Mercenary via C2S 0x61 MercItem(0)
  if (hud.isPointInMercPortrait(pt.x, pt.y)) {
    if (e.button === 2) {
      hud.toggleLeftPanel('merc')
      hud.syncPublishedState()
    } else if (e.button === 0 && hud.inventory.cursorItem && !hud.merc?.isDead) {
      const dispatchMercItem =
        (hud as any).onMercEquipSlotClick ??
        (hud.worldPanels as any).onMercEquipSlotClick ??
        (hud.worldPanels as any).onMercItem ??
        ((slot: number) => hud.commandSink?.mercItem?.(slot))
      dispatchMercItem(0)
      hud.syncPublishedState()
    }
    return
  }

  ;(hud as any).syncResolutionMode()
  const docking = hud.getDockingLayout()
  const barPt = toControlBarLocal(pt.x, pt.y, docking)

  hud.controlBar.handleMouseDown(barPt.x, barPt.y, {
    unspentStatPoints: hud.charSheet.attrs.statPoints,
    unspentSkillPoints: hud.skillTree.unspentSkillPoints,
  })

  // Belt slot click: right-click drinks potion; Shift+Left-Click returns to inventory; left-click places/swaps/removes belt item
  const beltHit = hud.belt.slotAtPoint(barPt.x, barPt.y)
  if (beltHit) {
    if (e.button === 2) {
      hud.drinkBeltSlot(beltHit.row * 4 + beltHit.col, Boolean(e.shiftKey))
      return
    }
    const beltPotion = hud.belt.getSlot(beltHit.col, beltHit.row)
    const rawBeltId =
      (beltPotion as { itemId?: number } | null)?.itemId ??
      (beltPotion ? Number(beltPotion.id) : NaN)
    const beltItemId = Number.isInteger(rawBeltId) && rawBeltId >= 0 ? beltItemIdFromRaw(rawBeltId) : undefined
    function beltItemIdFromRaw(id: number): number {
      return id
    }
    // D2Client.dll 0x6fb4b5f0: Shift + Left-Click on a belt slot moves the potion back into the inventory grid
    if (e.shiftKey && !hud.inventory.cursorItem && beltPotion) {
      if (hud.commandSink && beltItemId !== undefined) {
        const sink = hud.commandSink
        for (let irow = 0; irow < INV_GRID_ORIGIN.rows; irow++) {
          for (let icol = 0; icol < INV_GRID_ORIGIN.cols; icol++) {
            if (hud.inventory.getGridOverlaps(icol, irow, 1, 1).length === 0) {
              if (sink.onRemoveBeltItem) sink.onRemoveBeltItem(beltItemId)
              else sink.removeBeltItem?.(beltItemId)
              sink.placeCursorItem(beltItemId, icol, irow, 0)
              hud.syncPublishedState()
              return
            }
          }
        }
        ;(hud as any).playCantCarrySound?.()
        return
      }
      if (!hud.commandSink) {
        for (let irow = 0; irow < INV_GRID_ORIGIN.rows; irow++) {
          for (let icol = 0; icol < INV_GRID_ORIGIN.cols; icol++) {
            if (hud.inventory.getGridOverlaps(icol, irow, 1, 1).length === 0) {
              const removed = hud.belt.getSlot(beltHit.col, beltHit.row)
              hud.belt.setSlot(beltHit.col, beltHit.row, null)
              if (removed) {
                hud.inventory.gridItems.push({
                  item: {
                    id: removed.id,
                    code: removed.code ?? 'hp1',
                    name: removed.name,
                    nameZh: removed.nameZh,
                    baseNameZh: removed.nameZh,
                    invFile: removed.invFile,
                    quality: 'normal',
                    identified: true,
                    invWidth: 1,
                    invHeight: 1,
                    allowedSlots: [],
                    stats: [],
                  },
                  col: icol,
                  row: irow,
                })
                hud.onPlayUiSound?.(235)
                hud.syncPublishedState()
              }
              return
            }
          }
        }
        ;(hud as any).playCantCarrySound?.()
        return
      }
    }
    if (hud.commandSink) {
      const sink = hud.commandSink
      const slotIndex = beltHit.row * 4 + beltHit.col
      const cursor = hud.inventory.cursorItem
      if (cursor) {
        const cursorId = serverItemIdOf(cursor)
        ;(hud as any).playItemDropUiSound(cursor)
        if (beltPotion && beltItemId !== undefined) {
          if (sink.onSwapBeltItem) sink.onSwapBeltItem(cursorId, beltItemId)
          else sink.swapBeltItem?.(cursorId, beltItemId)
        } else {
          if (sink.onPutBeltItem) sink.onPutBeltItem(cursorId, slotIndex)
          else sink.putBeltItem?.(cursorId, slotIndex)
        }
        hud.syncPublishedState()
        return
      }
      if (beltPotion && beltItemId !== undefined && (sink.onRemoveBeltItem || sink.removeBeltItem)) {
        // item_pickup (235) is played once when the server moves the item to the cursor
        // (D2Client.dll 0x6fb328d9, ClientWorld ItemAction cursor branch) — never optimistically here (#991).
        if (sink.onRemoveBeltItem) sink.onRemoveBeltItem(beltItemId)
        else sink.removeBeltItem?.(beltItemId)
        hud.syncPublishedState()
        return
      }
    }
    return
  }

  if (e.button === 0 && !hud.inventory.cursorItem && hud.globes.handleClick(barPt.x, barPt.y)) {
    hud.syncPublishedState()
    return
  }

  if (hud.hotkeys.handleClick(barPt.x, barPt.y)) {
    hud.syncPublishedState()
    return
  }

  // Bar buttons only latch the pressed cell here; the action itself fires on
  // mouse-up inside the same button (see handleHudMouseUp).
  if (hud.controlBar.isInteractiveHit(barPt.x, barPt.y)) {
    hud.syncPublishedState()
    return
  }

  // Centered Trade Invitation / Waiting Modal (D2Client.dll 0x6fb099e0) spans across x = 400
  if (
    (hud.leftPanel === 'trade' || hud.worldPanels.activePanel === 'trade' || hud.trade?.pendingModal) &&
    (hud.trade?.pendingModal === 'wait' || hud.trade?.pendingModal === 'request') &&
    typeof (hud.worldPanels as any).handlePendingTradeModalClick === 'function'
  ) {
    const modalHandled = (hud.worldPanels as any).handlePendingTradeModalClick(
      pt.x,
      pt.y,
      (buttonId: number, complement = 0) => {
        if (typeof (hud.worldPanels as any).onTradeButtonClick === 'function') {
          ;(hud.worldPanels as any).onTradeButtonClick(buttonId, complement)
        } else if (typeof hud.onTradeButtonClick === 'function') {
          hud.onTradeButtonClick(buttonId, complement)
        } else {
          hud.commandSink?.clickButton?.(buttonId, complement)
        }
      },
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
    if (modalHandled) {
      hud.syncPublishedState()
      return
    }
  }

  // Centered Mercenary Hire Dialog (490x350) spans across x = 400; route in viewport space before leftPt.x <= 400
  if (
    (hud.leftPanel === 'hire' || hud.worldPanels.activePanel === 'hire') &&
    hud.worldPanels.isPointInHireMercDialog(
      pt.x,
      pt.y,
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
  ) {
    hud.worldPanels.handleHireMercClick(
      pt.x,
      pt.y,
      {
        onClose: () => {
          hud.leftPanel = 'none'
          hud.worldPanels.activePanel = 'none'
          hud.leaveLeftPanel('hire')
        },
        onHireMerc: (npcId: number, mercId: number) => {
          if (typeof (hud.worldPanels as any).onHireMercClick === 'function') {
            ;(hud.worldPanels as any).onHireMercClick(npcId, mercId)
          } else {
            hud.commandSink?.hireMerc?.(npcId, mercId)
          }
          hud.leftPanel = 'none'
          hud.worldPanels.activePanel = 'none'
        },
      },
      hud.viewportProfile.width,
      hud.viewportProfile.height,
    )
    if (hud.worldPanels.activePanel !== 'hire') {
      hud.leftPanel = 'none'
    }
    hud.syncPublishedState()
    return
  }

  // Left-Half Dock Click (or full-viewport `msg` / `hire` dialog)
  const leftPt = toLeftDockLocal(pt.x, pt.y, docking)
  if (
    hud.leftPanel === 'hire' ||
    hud.leftPanel === 'msg' ||
    (leftPt.x >= 0 && leftPt.x <= 400 && leftPt.y >= 0 && leftPt.y <= 553)
  ) {
    if (hud.leftPanel === 'char') {
      hud.charSheet.handleMouseDown(leftPt.x, leftPt.y)
      if (!hud.charSheet.visible) hud.leftPanel = 'none'
      hud.syncPublishedState()
      return
    } else if (hud.leftPanel !== 'none') {
      const dockKind = hud.leftPanel
      const clickX = dockKind === 'hire' || dockKind === 'msg' ? pt.x : leftPt.x
      const clickY = dockKind === 'hire' || dockKind === 'msg' ? pt.y : leftPt.y
      if (hud.partyMembers.length > 0 && hud.worldPanels.partyMembers.length === 0) {
        hud.worldPanels.partyMembers = hud.partyMembers
      }
      if (typeof (hud.worldPanels as any).handleActiveLeftPanelClick === 'function') {
        const priorSlotItem = hud.worldPanels.questRewardItem
        const handled = (hud.worldPanels as any).handleActiveLeftPanelClick(
          dockKind,
          clickX,
          clickY,
          e.button === 2,
          e.shiftKey,
          {
            onClose: () => {
              hud.leftPanel = 'none'
              ;(hud.worldPanels as any).activePanel = 'none'
              hud.leaveLeftPanel(dockKind)
            },
            onMercItem: (slot: number) => {
              if (typeof (hud.worldPanels as any).onMercEquipSlotClick === 'function') {
                ;(hud.worldPanels as any).onMercEquipSlotClick(slot)
              } else {
                hud.commandSink?.mercItem?.(slot)
              }
            },
            onHireMerc: (npcId: number, mercId: number) => {
              if (typeof (hud.worldPanels as any).onHireMercClick === 'function') {
                ;(hud.worldPanels as any).onHireMercClick(npcId, mercId)
              } else {
                hud.commandSink?.hireMerc?.(npcId, mercId)
              }
              hud.leftPanel = 'none'
              hud.worldPanels.activePanel = 'none'
            },
            onPartyAction: (action: number, targetPlayerId: number) => {
              if (typeof (hud.worldPanels as any).onPartyActionClick === 'function') {
                ;(hud.worldPanels as any).onPartyActionClick(action, targetPlayerId)
              } else if (typeof hud.onPartyActionClick === 'function') {
                hud.onPartyActionClick(action, targetPlayerId)
              } else {
                hud.commandSink?.partyAction?.(action, targetPlayerId)
              }
            },
            onSetHostile: (targetPlayerId: number, hostile: boolean, button = 1) => {
              if (typeof (hud.worldPanels as any).onHostileToggleClick === 'function') {
                ;(hud.worldPanels as any).onHostileToggleClick(targetPlayerId, hostile, button)
              } else if (typeof hud.onHostileToggleClick === 'function') {
                hud.onHostileToggleClick(targetPlayerId, hostile, button)
              } else {
                hud.commandSink?.setHostile?.(targetPlayerId, hostile, button)
              }
            },
            onSquelchToggle: (targetPlayerId: number, squelched: boolean) => {
              if (typeof hud.worldPanels.onSquelchToggle === 'function') {
                hud.worldPanels.onSquelchToggle(targetPlayerId, squelched)
              } else {
                hud.onSquelchToggle?.(targetPlayerId, squelched)
              }
            },
            onIgnoreToggle: (targetPlayerId: number, ignored: boolean) => {
              if (typeof hud.worldPanels.onIgnoreToggle === 'function') {
                hud.worldPanels.onIgnoreToggle(targetPlayerId, ignored)
              } else {
                hud.onIgnoreToggle?.(targetPlayerId, ignored)
              }
            },
            onClearMessages: () => {
              hud.chatOverlayMessages = []
              hud.messageLogEntries = []
              hud.worldPanels.messageLogEntries = []
              if (typeof hud.worldPanels.onClearMessages === 'function') {
                hud.worldPanels.onClearMessages()
              } else {
                hud.onClearMessages?.()
              }
            },
            onClickButton: (buttonId: number, complement = 0) => {
              if (typeof (hud.worldPanels as any).onTradeButtonClick === 'function') {
                ;(hud.worldPanels as any).onTradeButtonClick(buttonId, complement)
              } else if (typeof hud.onTradeButtonClick === 'function') {
                hud.onTradeButtonClick(buttonId, complement)
              } else {
                hud.commandSink?.clickButton?.(buttonId, complement)
              }
            },
            onOpenTradeGoldDialog: () => hud.openGoldDialog(2),
            onTradeGridClick: (
              col: number,
              row: number,
              hitItem: UiInventoryItem | null,
              isRightClick: boolean,
            ) => {
              if (typeof (hud.worldPanels as any).onTradeGridClick === 'function') {
                ;(hud.worldPanels as any).onTradeGridClick(col, row, hitItem, isRightClick)
              } else {
                ;(hud as any).forwardGridClick(2, col, row, hitItem ?? null, isRightClick)
              }
            },
            onConfirmQuestReward: (itemId: number, npcId = 0) => {
              if (typeof (hud.worldPanels as any).onConfirmQuestRewardClick === 'function') {
                ;(hud.worldPanels as any).onConfirmQuestRewardClick(itemId, npcId)
              } else if (typeof hud.onConfirmQuestRewardClick === 'function') {
                hud.onConfirmQuestRewardClick(itemId, npcId)
              } else if (hud.commandSink?.confirmQuestReward) {
                ;(
                  hud.commandSink.confirmQuestReward as
                    | ((itemId: number, npcId?: number) => void)
                    | undefined
                )?.(itemId, npcId)
              } else if (dockKind === 'imbue' && priorSlotItem) {
                const playerLevel = Math.max(
                  1,
                  hud.charSheet.attrs.level || hud.inventory.playerContext.level || 8,
                )
                hud.inventory.cursorItem = imbueUiInventoryItem113c(priorSlotItem, playerLevel)
              } else if ((dockKind === 'add_sockets' || dockKind === 'personalize') && priorSlotItem) {
                hud.inventory.cursorItem = priorSlotItem
              }
              hud.leftPanel = 'none'
              ;(hud.worldPanels as any).activePanel = 'none'
              if (
                dockKind === 'imbue' ||
                dockKind === 'add_sockets' ||
                dockKind === 'personalize' ||
                hud.inventory.cursorItem !== null
              ) {
                hud.rightPanel = 'inv'
                hud.inventory.visible = true
              }
            },
            onIneligibleItem: () => hud.onPlayUiSound?.(3),
            inventory: hud.inventory,
          },
          hud.viewportProfile.width,
          hud.viewportProfile.height,
        )
        if (handled) {
          hud.syncPublishedState()
          return
        }
      }
      hud.worldPanels.handleLeftDockClick(dockKind as any, leftPt.x, leftPt.y, {
        onClose: () => {
          hud.leftPanel = 'none'
          hud.leaveLeftPanel(dockKind)
        },
        onPartyAction: (action: number, targetPlayerId: number) => {
          if (typeof (hud.worldPanels as any).onPartyActionClick === 'function') {
            ;(hud.worldPanels as any).onPartyActionClick(action, targetPlayerId)
          } else if (typeof hud.onPartyActionClick === 'function') {
            hud.onPartyActionClick(action, targetPlayerId)
          } else {
            hud.commandSink?.partyAction?.(action, targetPlayerId)
          }
        },
        onSetHostile: (targetPlayerId: number, hostile: boolean, button = 1) => {
          if (typeof (hud.worldPanels as any).onHostileToggleClick === 'function') {
            ;(hud.worldPanels as any).onHostileToggleClick(targetPlayerId, hostile, button)
          } else if (typeof hud.onHostileToggleClick === 'function') {
            hud.onHostileToggleClick(targetPlayerId, hostile, button)
          } else {
            hud.commandSink?.setHostile?.(targetPlayerId, hostile, button)
          }
        },
        onStashGoldButton: () => hud.openGoldDialog(4),
        onStashDepositAll: () => void hud.commandSink?.depositAllToStash?.(),
        onVendorBuy: (item, shiftFill) => requireSink('vendorBuy').vendorBuy(serverItemIdOf(item), shiftFill),
        onVendorSell: (item) => requireSink('vendorSell').vendorSell(serverItemIdOf(item)),
        onVendorRepairAll: () => requireSink('vendorRepairAll').vendorRepairAll(),
        onPlayUiSound: (soundId: number) => hud.onPlayUiSound?.(soundId),
        onWaypointTeleport: (act, slug, levelId) => {
          if (hud.commandSink) {
            hud.commandSink.teleportToLevel(levelId)
          } else {
            callbacks.onWaypointTeleport(act, slug, levelId)
          }
        },
        ...(hud.commandSink
          ? {
              onTransmute: () => {
                hud.onPlayUiSound?.(4)
                hud.commandSink?.transmuteCube()
              },
              onContainerGridClick: (
                container: 'stash' | 'cube',
                col: number,
                row: number,
                hitItem: UiInventoryItem | null,
                isRightClick: boolean,
              ) =>
                (hud as any).forwardGridClick(
                  container === 'stash' ? 4 : 3,
                  col,
                  row,
                  hitItem,
                  isRightClick,
                  Boolean(e.shiftKey),
                ),
              onQuickTransferToInventory: (
                item: UiInventoryItem,
                targetCol: number,
                targetRow: number,
              ) => {
                const itemId = serverItemIdOf(item)
                hud.commandSink?.pickupItemToCursor(itemId)
                hud.commandSink?.placeCursorItem(itemId, targetCol, targetRow, 0)
              },
            }
          : {}),
        onOpenCube: () => hud.toggleLeftPanel('cube'),
        onCastTownPortal: (source, item) => callbacks.onCastTownPortal?.(source, item),
        inventory: hud.inventory,
        isShiftClick: e.shiftKey,
        isRightClick: e.button === 2,
      })
      hud.syncPublishedState()
      return
    }
  }

  // Right-Half Dock Click
  const rightPt = toRightDockLocal(pt.x, pt.y, docking)
  if (rightPt.x >= 400 && rightPt.x <= 800 && rightPt.y >= 0 && rightPt.y <= 553) {
    if (hud.rightPanel === 'inv') {
      if (
        !hud.inventory.isIdentifyMode() &&
        hud.pendingIdentifyScrollId === null &&
        !hud.inventory.cursorItem
      ) {
        const inInvGrid =
          rightPt.x >= INV_GRID_ORIGIN.x &&
          rightPt.x < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
          rightPt.y >= INV_GRID_ORIGIN.y &&
          rightPt.y < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
        const col = inInvGrid ? Math.floor((rightPt.x - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx) : -1
        const row = inInvGrid ? Math.floor((rightPt.y - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx) : -1
        const hit = inInvGrid
          ? hud.inventory.gridItems.find(
              (p) => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
            )
          : undefined

        // Stash quick transfer (Shift+Click in online/offline, or Right-Click on non-usable items offline)
        if (hud.leftPanel === 'stash' && ((e.shiftKey && e.button === 0) || (e.button === 2 && !hud.commandSink))) {
          if (inInvGrid && hit && (e.shiftKey || !isUsableRightClickItem(hit.item.code))) {
            const transferred = hud.worldPanels.quickTransferToStash(hit.item, hud.inventory)
            if (transferred && hud.commandSink && e.shiftKey && e.button === 0) {
              const placed = hud.worldPanels.stashItems[hud.worldPanels.stashItems.length - 1]
              const itemId = serverItemIdOf(hit.item)
              hud.commandSink.pickupItemToCursor(itemId)
              if (placed) {
                hud.commandSink.placeCursorItem(itemId, placed.col, placed.row, 4)
              }
            }
            hud.syncPublishedState()
            return
          }
        }

        // Horadric Cube quick transfer (Shift+Click in online/offline, or Right-Click on non-usable items offline)
        if (hud.leftPanel === 'cube' && ((e.shiftKey && e.button === 0) || (e.button === 2 && !hud.commandSink))) {
          if (inInvGrid && hit && (e.shiftKey || !isUsableRightClickItem(hit.item.code))) {
            const transferred = hud.worldPanels.quickTransferToCube(hit.item, hud.inventory)
            if (transferred && hud.commandSink && e.shiftKey && e.button === 0) {
              const placed = hud.worldPanels.cubeItems[hud.worldPanels.cubeItems.length - 1]
              const itemId = serverItemIdOf(hit.item)
              hud.commandSink.pickupItemToCursor(itemId)
              if (placed) {
                hud.commandSink.placeCursorItem(itemId, placed.col, placed.row, 3)
              }
            }
            hud.syncPublishedState()
            return
          }
        }

        // Belt quick transfer (`D2Client.dll 0x6FB47189` / `0x6fb49fb0`: Shift+Left-Click on beltable potion when Stash/Cube closed)
        if (
          e.shiftKey &&
          e.button === 0 &&
          hud.leftPanel !== 'stash' &&
          hud.leftPanel !== 'cube' &&
          inInvGrid &&
          hit &&
          isAutoBeltablePotion(hit.item)
        ) {
          const beltSlot = hud.belt.autoPlacePotionSlot(hit.item)
          if (beltSlot) {
            const hitIdx = hud.inventory.gridItems.indexOf(hit)
            if (hitIdx !== -1) {
              hud.inventory.gridItems.splice(hitIdx, 1)
            }
            hud.onPlayUiSound?.(235)
            if (hud.commandSink) {
              const itemId = serverItemIdOf(hit.item)
              if (hud.commandSink.onAutoBeltItem) {
                hud.commandSink.onAutoBeltItem(itemId)
              } else if (hud.commandSink.autoBeltItem) {
                hud.commandSink.autoBeltItem(itemId)
              } else {
                hud.commandSink.pickupItemToCursor(itemId)
                hud.commandSink.putBeltItem?.(itemId, beltSlot.row * 4 + beltSlot.col)
              }
            }
          } else {
            ;(hud as any).playCantCarrySound?.()
          }
          hud.syncPublishedState()
          return
        }
      }

      if (
        hud.leftPanel === 'vendor' &&
        !hud.inventory.isIdentifyMode() &&
        hud.pendingIdentifyScrollId === null &&
        (hud as any).handleVendorInventoryClick(rightPt.x, rightPt.y, e.button === 2, Boolean(e.ctrlKey))
      ) {
        hud.syncPublishedState()
        return
      }

      // D2Client.dll 0x6fb50375: while an item is placed in the useitem slot (state == 2),
      // WM_LBUTTONDOWN does not forward clicks to INVENTORY_HandleClick (0x6fb4be70).
      if (
        (hud.leftPanel === 'imbue' ||
          hud.leftPanel === 'add_sockets' ||
          hud.leftPanel === 'personalize' ||
          hud.leftPanel === 'orifice') &&
        hud.worldPanels.questRewardItem !== null
      ) {
        hud.syncPublishedState()
        return
      }

      if (!hud.commandSink && hud.onWeaponSwitch) {
        const swapTabs = [WEAPON_SWAP_TABS_BOUNDS.left, WEAPON_SWAP_TABS_BOUNDS.right]
        for (const tab of swapTabs) {
          if (rightPt.x >= tab.x && rightPt.x <= tab.x + tab.w && rightPt.y >= tab.y && rightPt.y <= tab.y + tab.h) {
            const targetSet: 0 | 1 = rightPt.x < tab.x + tab.w / 2 ? 0 : 1
            if (targetSet !== hud.inventory.weaponSwapSet) {
              hud.onWeaponSwitch()
            }
            hud.syncPublishedState()
            return
          }
        }
      }

      if (
        hud.commandSink &&
        (hud as any).forwardInventoryPanelClick(rightPt.x, rightPt.y, e.button === 2, Boolean(e.shiftKey))
      ) {
        hud.syncPublishedState()
        return
      }

      hud.syncPlayerContext()
      hud.inventory.handleClick(
        rightPt.x,
        rightPt.y,
        {
          onOpenCube: () => hud.toggleLeftPanel('cube'),
          onCastTownPortal: (source, item) => callbacks.onCastTownPortal?.(source, item),
          onGoldButton: () =>
            hud.openGoldDialog(hud.leftPanel === 'stash' ? 3 : hud.leftPanel === 'trade' ? 2 : 0),
          onUseItem: (item) => {
            ;(hud as any).playItemUseUiSound(item)
            const c = (item.code ?? '').trim().toLowerCase()
            if (c === 'bks' || c === 'bkd') {
              hud.worldPanels.openBarkscroll(c === 'bkd')
              hud.setLeftPanel('barkscroll')
            } else if (c === 'tr1') {
              hud.worldPanels.openRecipeScroll()
              hud.setLeftPanel('recipescroll')
            }
            return true
          },
        },
        e.button === 2 ? 2 : 0,
        {
          stashItems: hud.worldPanels.stashItems,
          cubeItems: hud.worldPanels.cubeItems,
        },
      )
      if (!hud.inventory.visible) hud.rightPanel = 'none'
      hud.syncPublishedState()
      return
    } else if (hud.rightPanel === 'skill') {
      hud.skillTree.handleClick(rightPt.x, rightPt.y, (skillId) => (hud as any).handleSkillAllocated(skillId))
      if (!hud.skillTree.visible) hud.rightPanel = 'none'
      hud.syncPublishedState()
      return
    }
  }
}

/**
 * Inventory click while a store is open and the sell / repair cursor is armed (D2Client 0x6fb472d0):
 * right-click disarms; sell sends `0x33` for the bag item; repair sends `0x35` for the bag or equipped item.
 * Returns `false` in the idle / buy state so the click picks up / places items as usual.
 */
export function handleVendorInventoryClick(
  hud: HudManager,
  x: number,
  y: number,
  isRightClick: boolean,
  isCtrlClick = false,
): boolean {
  const requireSink = (action: string): HudCommandSink => (hud as any).requireSink(action)
  const state = hud.worldPanels.vendorTradeState
  if (state !== 'sell' && state !== 'repair') {
    if (state === 'idle' && isCtrlClick && !isRightClick) {
      if (
        x >= INV_GRID_ORIGIN.x &&
        x < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
        y >= INV_GRID_ORIGIN.y &&
        y < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
      ) {
        const col = Math.floor((x - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx)
        const row = Math.floor((y - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx)
        const target =
          hud.inventory.gridItems.find(
            (p) => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
          )?.item ?? null
        if (target) {
          const sink = requireSink('vendorSell')
          sink.vendorSell(serverItemIdOf(target))
          return true
        }
      }
    }
    return false
  }
  if (isRightClick) {
    hud.worldPanels.vendorTradeState = 'idle'
    return true
  }
  let target: UiInventoryItem | null = null
  if (
    x >= INV_GRID_ORIGIN.x &&
    x < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
    y >= INV_GRID_ORIGIN.y &&
    y < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
  ) {
    const col = Math.floor((x - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx)
    const row = Math.floor((y - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx)
    target =
      hud.inventory.gridItems.find(
        (p) => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
      )?.item ?? null
  } else if (state === 'repair') {
    for (const [slot, rect] of Object.entries(EQUIP_SLOTS_LAYOUT) as [
      EquipSlotId,
      (typeof EQUIP_SLOTS_LAYOUT)[EquipSlotId],
    ][]) {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        target = hud.inventory.equipped[slot] ?? null
        break
      }
    }
  }
  if (!target) return true
  const sink = requireSink(state === 'sell' ? 'vendorSell' : 'vendorRepairItem')
  if (state === 'sell') sink.vendorSell(serverItemIdOf(target))
  else sink.vendorRepairItem(serverItemIdOf(target))
  return true
}

/**
 * Forward an inventory-panel click (grid / paperdoll) to the server sink. Returns `false` when the point is not
 * on an item area so the panel's own chrome (close / gold buttons / swap tabs) still handles it.
 */
export function forwardInventoryPanelClick(
  hud: HudManager,
  x: number,
  y: number,
  isRightClick: boolean,
  isShiftClick = false,
): boolean {
  const sink = hud.commandSink
  if (!sink) return false
  const swapTabs = [WEAPON_SWAP_TABS_BOUNDS.left, WEAPON_SWAP_TABS_BOUNDS.right]
  for (const tab of swapTabs) {
    if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
      const targetSet: 0 | 1 = x < tab.x + tab.w / 2 ? 0 : 1
      if (targetSet !== hud.inventory.weaponSwapSet) {
        if (typeof sink.swapWeapons === 'function') {
          sink.swapWeapons()
        } else {
          hud.onWeaponSwitch?.()
        }
      }
      return true
    }
  }
  const g = INV_GRID_ORIGIN
  if (x >= g.x && x < g.x + g.cols * g.cellPx && y >= g.y && y < g.y + g.rows * g.cellPx) {
    const cursor = hud.inventory.cursorItem
    if (cursor && !isRightClick && hud.pendingIdentifyScrollId === null) {
      const placement = computeCursorItemGridPlacement(
        x,
        y,
        g,
        cursor,
        hud.inventory.gridItems,
      )
      const isBoxItem = (it: UiInventoryItem | null | undefined) =>
        (it?.code ?? '').trim().toLowerCase() === 'box'
      const boxTarget =
        placement.overlaps.length === 1 && isBoxItem(placement.overlaps[0]!.item)
          ? placement.overlaps[0]!.item
          : (!placement.inBounds || placement.overlaps.length > 1) &&
              placement.directHit &&
              isBoxItem(placement.directHit.item)
            ? placement.directHit.item
            : null
      if (boxTarget) {
        ;(hud as any).forwardGridClick(0, placement.rawCol, placement.rawRow, boxTarget, false)
        return true
      }
      if (
        placement.directHit &&
        (isScrollForTome(cursor.code, placement.directHit.item.code) ||
          (isSocketableUiItem(cursor) &&
            (placement.directHit.item.sockets ?? 0) >
              (placement.directHit.item.socketedItems?.length ?? 0)))
      ) {
        ;(hud as any).forwardGridClick(
          0,
          placement.rawCol,
          placement.rawRow,
          placement.directHit.item,
          false,
        )
        return true
      }
      if (!placement.inBounds || placement.overlaps.length > 1) {
        return true
      }
      ;(hud as any).forwardGridClick(
        0,
        placement.col,
        placement.row,
        placement.overlaps[0]?.item ?? null,
        false,
      )
      return true
    }
    const col = Math.floor((x - g.x) / g.cellPx)
    const row = Math.floor((y - g.y) / g.cellPx)
    const hit = hud.inventory.gridItems.find(
      (p) => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    ;(hud as any).forwardGridClick(0, col, row, hit?.item ?? null, isRightClick, isShiftClick)
    return true
  }
  for (const slot of Object.keys(EQUIP_SLOTS_LAYOUT) as EquipSlotId[]) {
    const r = EQUIP_SLOTS_LAYOUT[slot]
    if (x < r.x || x >= r.x + r.w || y < r.y || y >= r.y + r.h) continue
    const equipped = hud.inventory.equipped[slot]
    if (hud.pendingIdentifyScrollId !== null) {
      const scrollId = hud.pendingIdentifyScrollId
      hud.pendingIdentifyScrollId = null
      hud.inventory.cancelIdentifyMode()
      if (!isRightClick && equipped && isUiItemUnidentified(equipped)) {
        const targetId = serverItemIdOf(equipped)
        if (sink.onIdentifyItem) sink.onIdentifyItem(targetId, scrollId)
        else sink.identifyItem?.(targetId, scrollId)
      }
      return true
    }
    if (isRightClick) {
      return true
    }
    const cursor = hud.inventory.cursorItem
    if (cursor) {
      const classCode = hud.inventory.playerContext.classCode ?? hud.currentClass ?? null
      const isUnid = isUiItemUnidentified(cursor)
      const canUse = canPlayerUseUiItem(cursor, hud.inventory.playerContext)
      if (isUnid || !canUse || !isItemAllowedInSlot(cursor, slot)) {
        ;(hud as any).playCantUseSound()
        return true
      }

      ;(hud as any).playItemDropUiSound(cursor)
      const cursorId = serverItemIdOf(cursor)
      if (slot === 'weapon1' || slot === 'weapon2') {
        const otherSlot: EquipSlotId = slot === 'weapon1' ? 'weapon2' : 'weapon1'
        const otherEquipped = hud.inventory.equipped[otherSlot]

        if (equipped) {
          if (otherEquipped && !areHandSlotItemsCompatible(cursor, otherEquipped, classCode)) {
            if (sink.onSwap2HandedDual) sink.onSwap2HandedDual(cursorId, slot)
            else if (sink.swap2HandedDual) sink.swap2HandedDual(cursorId, slot)
            else if (sink.onSwapEquipItem) sink.onSwapEquipItem(cursorId, slot)
            else if (sink.swapEquipItem) sink.swapEquipItem(cursorId, slot)
            else sink.equipItem(cursorId, slot)
          } else {
            if (sink.onSwapEquipItem) sink.onSwapEquipItem(cursorId, slot)
            else if (sink.swapEquipItem) sink.swapEquipItem(cursorId, slot)
            else sink.equipItem(cursorId, slot)
          }
        } else {
          if (otherEquipped && !areHandSlotItemsCompatible(cursor, otherEquipped, classCode)) {
            if (sink.onSwap2HandedItem) sink.onSwap2HandedItem(cursorId, slot)
            else if (sink.swap2HandedItem) sink.swap2HandedItem(cursorId, slot)
            else sink.equipItem(cursorId, slot)
          } else {
            sink.equipItem(cursorId, slot)
          }
        }
      } else {
        if (equipped) {
          if (sink.onSwapEquipItem) sink.onSwapEquipItem(cursorId, slot)
          else if (sink.swapEquipItem) sink.swapEquipItem(cursorId, slot)
          else sink.equipItem(cursorId, slot)
        } else {
          sink.equipItem(cursorId, slot)
        }
      }
    } else if (equipped) {
      // item_pickup (235) comes from the S2C cursor event (D2Client.dll 0x6fb328d9), not here (#991).
      sink.unequipItem(slot)
    } else if (slot === 'weapon1' || slot === 'weapon2') {
      const classCode = hud.inventory.playerContext.classCode ?? hud.currentClass ?? null
      const otherSlot: EquipSlotId = slot === 'weapon1' ? 'weapon2' : 'weapon1'
      const otherEquipped = hud.inventory.equipped[otherSlot]
      if (otherEquipped && isTwoHandedForClass(otherEquipped, classCode)) {
        sink.unequipItem(otherSlot)
      }
    }
    return true
  }
  return false
}

/** Forward a container grid click: place/swap/socket/tome/cube-indirect the cursor item, identify, use (right-click) or pick up the hit item. */
export function forwardGridClick(
  hud: HudManager,
  buffer: number,
  col: number,
  row: number,
  hitItem: UiInventoryItem | null,
  isRightClick: boolean,
  isShiftClick = false,
): void {
  const sink = hud.commandSink
  if (!sink) return

  if (hud.pendingIdentifyScrollId !== null) {
    const scrollId = hud.pendingIdentifyScrollId
    hud.pendingIdentifyScrollId = null
    hud.inventory.cancelIdentifyMode()
    if (!isRightClick && hitItem && isUiItemUnidentified(hitItem)) {
      const targetId = serverItemIdOf(hitItem)
      if (sink.onIdentifyItem) sink.onIdentifyItem(targetId, scrollId)
      else sink.identifyItem?.(targetId, scrollId)
    }
    return
  }

  const cursor = hud.inventory.cursorItem
  if (cursor) {
    if (isRightClick) return
    const cursorId = serverItemIdOf(cursor)
    if (hitItem) {
      const targetId = serverItemIdOf(hitItem)
      const hitCode = (hitItem.code ?? '').trim().toLowerCase()
      const cursorCode = (cursor.code ?? '').trim().toLowerCase()
      // D2Client.dll 0x6fb470b3..0x6fb47154: dropping held item onto Horadric Cube (`box`) in Inventory/Stash
      if (buffer !== 3 && hitCode === 'box') {
        if (cursorCode === 'box' || cursorCode === 'cube' || !hud.worldPanels.canFitInCube(cursor)) {
          ;(hud as any).playCantCarrySound()
          return
        }
        ;(hud as any).playItemDropUiSound(cursor)
        if (sink.onItemToCube) sink.onItemToCube(cursorId, targetId)
        else sink.itemToCube?.(cursorId, targetId)
        return
      }
      if (isScrollForTome(cursor.code, hitItem.code)) {
        ;(hud as any).playItemDropUiSound(cursor)
        if (sink.onScrollToBook) sink.onScrollToBook(cursorId, targetId)
        else sink.scrollToBook?.(cursorId, targetId)
        return
      }
      if (isSocketableUiItem(cursor) && (hitItem.sockets ?? 0) > (hitItem.socketedItems?.length ?? 0)) {
        ;(hud as any).playItemDropUiSound(cursor)
        if (sink.onSocketItem) sink.onSocketItem(cursorId, targetId)
        else sink.socketItem?.(cursorId, targetId)
        return
      }
      ;(hud as any).playItemDropUiSound(cursor)
      if (sink.onSwapContainerItem) {
        sink.onSwapContainerItem(cursorId, targetId, col, row, buffer)
      } else if (sink.swapContainerItem) {
        sink.swapContainerItem(cursorId, targetId, col, row, buffer)
      } else {
        sink.placeCursorItem(cursorId, col, row, buffer)
      }
      return
    }
    ;(hud as any).playItemDropUiSound(cursor)
    sink.placeCursorItem(cursorId, col, row, buffer)
  } else if (hitItem && isShiftClick && !isRightClick) {
    const itemId = serverItemIdOf(hitItem)
    const w = Math.max(1, hitItem.invWidth ?? 1)
    const h = Math.max(1, hitItem.invHeight ?? 1)
    if (buffer === 0) {
      // Shift + Left-Click in inventory:
      // 1) If Stash is open (`0x6fb49fb0`), quick-transfer to first available Stash slot (buffer 4).
      if (hud.leftPanel === 'stash') {
        for (let srow = 0; srow <= STASH_GRID_ORIGIN.rows - h; srow++) {
          for (let scol = 0; scol <= STASH_GRID_ORIGIN.cols - w; scol++) {
            if (hud.worldPanels.canPlaceInStash(scol, srow, w, h)) {
              sink.pickupItemToCursor(itemId)
              sink.placeCursorItem(itemId, scol, srow, 4)
              return
            }
          }
        }
        ;(hud as any).playCantCarrySound?.()
        return
      }
      // 2) If Horadric Cube is open, quick-transfer to first available Cube slot (buffer 3).
      if (hud.leftPanel === 'cube') {
        const hitCode = (hitItem.code ?? '').trim().toLowerCase()
        if (hitCode === 'box' || hitCode === 'cube') {
          ;(hud as any).playCantCarrySound?.()
          return
        }
        for (let crow = 0; crow <= CUBE_GRID_ORIGIN.rows - h; crow++) {
          for (let ccol = 0; ccol <= CUBE_GRID_ORIGIN.cols - w; ccol++) {
            if (hud.worldPanels.canPlaceInCube(ccol, crow, w, h)) {
              sink.pickupItemToCursor(itemId)
              sink.placeCursorItem(itemId, ccol, crow, 3)
              return
            }
          }
        }
        ;(hud as any).playCantCarrySound?.()
        return
      }
      // 3) Otherwise, if item is a beltable potion, send C2S 0x63 ItemToBelt (`0x6fb49fb0` -> `0x6fb47240`).
      if (isAutoBeltablePotion(hitItem)) {
        if (hud.belt.canAutoPlacePotion(hitItem)) {
          if (sink.onAutoBeltItem) sink.onAutoBeltItem(itemId)
          else if (sink.autoBeltItem) sink.autoBeltItem(itemId)
          else sink.pickupItemToCursor(itemId)
        } else {
          ;(hud as any).playCantCarrySound?.()
        }
        return
      }
      sink.pickupItemToCursor(itemId)
      return
    }
    if (buffer === 4 || buffer === 3) {
      // Shift + Left-Click in Stash (4) or Cube (3): quick-transfer to first available Inventory slot (buffer 0).
      for (let irow = 0; irow <= INV_GRID_ORIGIN.rows - h; irow++) {
        for (let icol = 0; icol <= INV_GRID_ORIGIN.cols - w; icol++) {
          if (hud.inventory.getGridOverlaps(icol, irow, w, h).length === 0) {
            sink.pickupItemToCursor(itemId)
            sink.placeCursorItem(itemId, icol, irow, 0)
            return
          }
        }
      }
      ;(hud as any).playCantCarrySound?.()
      return
    }
    sink.pickupItemToCursor(itemId)
  } else if (hitItem && isRightClick) {
    const hitCode = (hitItem.code ?? '').trim().toLowerCase()
    if (buffer === 0 && (hitCode === 'isc' || hitCode === 'ibk')) {
      if (hud.inventory.startIdentifyMode(hitItem, 'inventory')) {
        ;(hud as any).playItemUseUiSound(hitItem)
        const itemId = serverItemIdOf(hitItem)
        hud.pendingIdentifyScrollId = itemId
        if (sink.onUseInventoryItem) sink.onUseInventoryItem(itemId)
        else sink.useItem(itemId)
      }
      return
    }
    if (isUsableRightClickItem(hitItem.code)) {
      ;(hud as any).playItemUseUiSound(hitItem)
      const itemId = serverItemIdOf(hitItem)
      if (sink.onUseInventoryItem) sink.onUseInventoryItem(itemId)
      else sink.useItem(itemId)
      if (hitCode === 'box') {
        if (hud.commandSink) {
          if (hud.goldDialog && hud.goldDialog.mode !== 0) hud.goldDialog = null
          hud.showCubePanel()
        } else {
          hud.setLeftPanel('cube')
        }
      } else if (hitCode === 'bks' || hitCode === 'bkd') {
        hud.worldPanels.openBarkscroll(hitCode === 'bkd')
        hud.setLeftPanel('barkscroll')
      } else if (hitCode === 'tr1') {
        hud.worldPanels.openRecipeScroll()
        hud.setLeftPanel('recipescroll')
      }
    }
  } else if (hitItem) {
    // item_pickup (235) comes from the S2C cursor event (D2Client.dll 0x6fb328d9), not here (#991).
    sink.pickupItemToCursor(serverItemIdOf(hitItem))
  }
}

export function handleSkillAllocated(hud: HudManager, skillId: number): void {
  // Server authority: request `AddSkillPoint`; the tree and quickbar update from the server skill list.
  if (hud.commandSink) {
    hud.commandSink.allocateSkill(skillId)
    return
  }
  if (isPassiveSkill(skillId)) return
  const catalogEntry = SKILLS_BY_ID[skillId]
  if (!catalogEntry) return

  const currentHard = hud.skillTree.hardPoints.get(skillId) ?? 1
  const mana = calculateManaCost(catalogEntry, currentHard)
  const leftUsable = isLeftUsableSkill(skillId)

  hud.hotkeys.addOrUpdateSkill({
    skillId,
    name: getSkillName(skillId, 'ENG'),
    nameZh: getSkillName(skillId, 'CHI'),
    level: currentHard,
    manaCost: mana,
    leftUsable,
    rightUsable: true,
    isAura: isAuraSkill(skillId),
  })
}
