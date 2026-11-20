/**
 * Issue #927: 1.13c panel close-button semantics parity.
 *
 * Every panel close `X` (inventory, character sheet, skill tree, quest log, stash /
 * waypoint / cube / barkscroll / recipe-scroll generic X, vendor close slot, merc
 * screen) must follow the same 1.13c mouse-driver semantics standardized for the
 * `Level.dc6` buttons in commit c90742e1: mouse-down only latches the depressed
 * `buysellbtn.dc6` cell (frame 11), the close fires on mouse-up landing back inside
 * the same button, and dragging off the button before releasing cancels it.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  CLOSE_BTN_NORMAL_FRAME,
  CLOSE_BTN_PRESSED_FRAME,
  PanelCloseButton,
  closeButtonFrame,
} from '../../src/client/ui/close-button.ts'
import { InventoryPanel, INV_CLOSE_BTN_BOUNDS } from '../../src/client/ui/inventory.ts'
import { CharacterSheetPanel, CHAR_CLOSE_BTN_BOUNDS } from '../../src/client/ui/character-sheet.ts'
import { SkillTreePanel } from '../../src/client/ui/skill-tree-panel.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'

const closeCenter = (b: { x: number; y: number; w: number; h: number }) => ({
  x: b.x + b.w / 2,
  y: b.y + b.h / 2,
})

describe('Issue #927: 1.13c close-button semantics (press depresses, release fires)', () => {
  it('closeButtonFrame picks buysellbtn.dc6 cell 10 raised / 11 depressed', () => {
    expect(CLOSE_BTN_NORMAL_FRAME).toBe(10)
    expect(CLOSE_BTN_PRESSED_FRAME).toBe(11)
    expect(closeButtonFrame(false)).toBe(10)
    expect(closeButtonFrame(true)).toBe(11)
  })

  it('PanelCloseButton latches on press and fires only on an inside release', () => {
    const btn = new PanelCloseButton(() => ({ x: 100, y: 200, w: 32, h: 32 }))
    expect(btn.isPressed).toBe(false)
    expect(btn.frame()).toBe(10)

    // Press outside never latches.
    btn.press(50, 50)
    expect(btn.isPressed).toBe(false)

    // Press inside latches the depressed cell without firing anything.
    btn.press(116, 216)
    expect(btn.isPressed).toBe(true)
    expect(btn.frame()).toBe(11)

    // Releasing back inside triggers and pops the latch.
    expect(btn.release(110, 220)).toBe(true)
    expect(btn.isPressed).toBe(false)
    expect(btn.frame()).toBe(10)
  })

  it('PanelCloseButton cancels when the release lands off the button', () => {
    const btn = new PanelCloseButton(() => ({ x: 100, y: 200, w: 32, h: 32 }))
    btn.press(116, 216)
    expect(btn.release(400, 400)).toBe(false)
    expect(btn.isPressed).toBe(false)
  })

  it('PanelCloseButton with a null rect (unknown class) never latches or fires', () => {
    const btn = new PanelCloseButton(() => null)
    btn.press(116, 216)
    expect(btn.isPressed).toBe(false)
    expect(btn.release(116, 216)).toBe(false)
  })

  it('inventory close X: press keeps the panel open, mouse-up inside closes, drag-out cancels', () => {
    const inv = new InventoryPanel()
    inv.visible = true
    const c = closeCenter(INV_CLOSE_BTN_BOUNDS)

    // Press: consumed, still open, depressed cell latched.
    expect(inv.handleClick(c.x, c.y)).toBe(true)
    expect(inv.visible).toBe(true)
    expect(inv.closeButton.isPressed).toBe(true)
    expect(inv.closeButton.frame()).toBe(11)

    // Release inside: the panel closes.
    expect(inv.handleMouseUp(c.x, c.y)).toBe(true)
    expect(inv.visible).toBe(false)

    // Drag-out cancel: press, release far away — panel stays open, latch cleared.
    inv.visible = true
    inv.handleClick(c.x, c.y)
    expect(inv.handleMouseUp(c.x, c.y - 200)).toBe(false)
    expect(inv.visible).toBe(true)
    expect(inv.closeButton.frame()).toBe(10)
  })

  it('character sheet close X follows the same latch / inside-release / drag-out-cancel flow', () => {
    const sheet = new CharacterSheetPanel()
    sheet.visible = true
    const c = closeCenter(CHAR_CLOSE_BTN_BOUNDS)

    sheet.handleMouseDown(c.x, c.y)
    expect(sheet.visible).toBe(true)
    expect(sheet.closeButton.isPressed).toBe(true)

    // Drag off and release: nothing fires.
    expect(sheet.handleMouseUp(c.x - 150, c.y)).toBe(false)
    expect(sheet.visible).toBe(true)
    expect(sheet.closeButton.frame()).toBe(10)

    // Press + release inside closes the sheet.
    sheet.handleMouseDown(c.x, c.y)
    expect(sheet.handleMouseUp(c.x, c.y)).toBe(true)
    expect(sheet.visible).toBe(false)
  })

  it('skill tree close X follows the same latch / inside-release / drag-out-cancel flow', () => {
    const tree = new SkillTreePanel('sor')
    tree.visible = true
    tree.activeTab = 2 // Cold tab socket at ox + 171
    const bounds = tree.getCloseButtonBounds()!
    const c = closeCenter(bounds)

    expect(tree.handleClick(c.x, c.y)).toBe(true)
    expect(tree.visible).toBe(true)
    expect(tree.closeButton.isPressed).toBe(true)

    expect(tree.handleMouseUp(c.x + 300, c.y)).toBe(false)
    expect(tree.visible).toBe(true)
    expect(tree.closeButton.frame()).toBe(10)

    expect(tree.handleClick(c.x, c.y)).toBe(true)
    expect(tree.handleMouseUp(c.x, c.y)).toBe(true)
    expect(tree.visible).toBe(false)
  })

  it('quest log close button latches on mousedown and closes on mouse-up landing back on it', () => {
    const wp = new WorldPanelsHud()
    const onClose = vi.fn()
    // Quest Log Close hitbox `relX ∈ [272, 313], relY ∈ [386, 425]` (ox = 80, oy = 60).
    const handled = wp.handleLeftDockClick('quest', 80 + 290, 60 + 400, {
      onClose,
      onWaypointTeleport: () => {},
    })
    expect(handled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    expect(wp.hasPendingCloseRelease()).toBe(true)

    // Release back on the button fires the close exactly once.
    expect(wp.releaseCloseButton(80 + 290, 60 + 400, 80 + 290, 60 + 400)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(wp.hasPendingCloseRelease()).toBe(false)
  })

  it('stash generic bottom-right X cancels when released off the button', () => {
    const wp = new WorldPanelsHud()
    const onClose = vi.fn()
    // Generic bottom X: `relY ∈ [380, 426]`, right branch `relX >= 260` (ox = 80, oy = 60).
    const handled = wp.handleLeftDockClick('stash', 80 + 280, 60 + 400, {
      onClose,
      onStashGoldButton: () => {},
    })
    expect(handled).toBe(true)
    expect(wp.hasPendingCloseRelease()).toBe(true)

    // Release far away: cancelled without firing.
    expect(wp.releaseCloseButton(80 + 100, 60 + 100, 80 + 100, 60 + 100)).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(wp.hasPendingCloseRelease()).toBe(false)

    // Press + release back inside fires.
    wp.handleLeftDockClick('stash', 80 + 280, 60 + 400, { onClose })
    expect(wp.releaseCloseButton(80 + 290, 60 + 410, 80 + 290, 60 + 410)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cancelCloseButton drops a held close X (panel closed via hotkey mid-hold)', () => {
    const wp = new WorldPanelsHud()
    const onClose = vi.fn()
    wp.handleLeftDockClick('quest', 80 + 290, 60 + 400, { onClose })
    expect(wp.hasPendingCloseRelease()).toBe(true)

    wp.cancelCloseButton()
    expect(wp.hasPendingCloseRelease()).toBe(false)

    // A later mouse-up inside the dead button region must not fire a stale close.
    expect(wp.releaseCloseButton(80 + 290, 60 + 400, 80 + 290, 60 + 400)).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('vendor close slot defers the close to mouse-up landing back on the same slot', () => {
    const wp = new WorldPanelsHud()
    wp.activeVendorDescriptor = { hcIdx: 147, vendorId: 7 } as any
    const onClose = vi.fn()
    // Trader layout [buy, sell, blank, close]: slot 3 hit box relX ∈ (273, 318), relY ∈ (371, 415).
    const handled = wp.handleLeftDockClick('vendor', 80 + 293, 60 + 395, {
      onClose,
      onWaypointTeleport: () => {},
    })
    expect(handled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    expect(wp.hasPendingCloseRelease()).toBe(true)

    // Release on a different slot (slot 0 buy at relX ∈ (116, 161)): cancelled.
    expect(wp.releaseCloseButton(80 + 130, 60 + 395, 80 + 130, 60 + 395)).toBe(false)
    expect(onClose).not.toHaveBeenCalled()

    // Press + release back on the close slot fires.
    wp.handleLeftDockClick('vendor', 80 + 293, 60 + 395, { onClose })
    expect(wp.releaseCloseButton(80 + 300, 60 + 400, 80 + 300, 60 + 400)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('useitem window close (imbue / orifice family) defers the close to mouse-up', () => {
    const wp = new WorldPanelsHud()
    wp.activePanel = 'orifice'
    const onClose = vi.fn()
    // Close button 1 hit box [177..209]x[224..256] (useitem.cpp absolute coordinates).
    const handled = wp.handleActiveLeftPanelClick('orifice', 190, 240, false, false, { onClose })
    expect(handled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    expect(wp.hasPendingCloseRelease()).toBe(true)
    expect(wp.pressedUseItemButton).toBe(1)

    // Release back on the button returns the item and closes.
    expect(wp.releaseCloseButton(190, 240, 190, 240)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(wp.pressedUseItemButton).toBeNull()
  })
})
