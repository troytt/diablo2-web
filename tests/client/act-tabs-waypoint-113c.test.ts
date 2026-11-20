/**
 * Issue #933: Quest Log / Waypoint panel act-tab visibility + waypoint row button semantics.
 *
 * 1. 1.13c hides the `Act II..V` tabs until the player has reached those acts in the
 *    current difficulty. The server has no dedicated packet for this, so visibility
 *    derives from what the client already mirrors: the act the player stands in, any
 *    unlocked waypoint in the act, or any started quest word for the act.
 * 2. Waypoint row icons follow the standard 1.13c button semantics (c90742e1 / #932):
 *    hovering keeps the raised cell (only the label brightens), mouse-down latches the
 *    depressed cell, and the teleport fires on mouse-up landing back on the same row.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ACT_TAB_LAYOUT,
  ACT_WAYPOINTS,
  WorldPanelsHud,
  getActQuests,
  questFlagWordIndex,
} from '../../src/client/ui/world-panels.ts'

const OX = 80
const OY = 60
const rowY = (i: number) => OY + 62 + i * 36

describe('Issue #933: act tab visibility (acts not reached stay hidden)', () => {
  it('starts with only Act I visible on a fresh difficulty (no waypoints, no quest progress)', () => {
    const wp = new WorldPanelsHud()
    expect(wp.visibleActTabCount()).toBe(1)
  })

  it('follows the act the player currently stands in', () => {
    const wp = new WorldPanelsHud()
    wp.setCurrentLevel(40) // Lut Gholein (Act 2)
    expect(wp.visibleActTabCount()).toBe(2)
    wp.setCurrentLevel(75) // Kurast Docks (Act 3)
    expect(wp.visibleActTabCount()).toBe(3)
    wp.setCurrentLevel(109) // Harrogath (Act 5)
    expect(wp.visibleActTabCount()).toBe(5)
  })

  it('counts acts with unlocked waypoints as reached (evidence of a previous visit)', () => {
    const wp = new WorldPanelsHud()
    wp.setWaypointUnlocked(ACT_WAYPOINTS[2]![0]!.waypointId, true) // Lut Gholein town pad
    expect(wp.visibleActTabCount()).toBe(2)
  })

  it('counts acts with started quest words as reached', () => {
    const wp = new WorldPanelsHud()
    const flags = new Array<number>(48).fill(0)
    flags[questFlagWordIndex(getActQuests(2)[0]!)] = 0x0001 // first Act 2 quest started
    wp.applyServerQuestFlags(flags)
    expect(wp.visibleActTabCount()).toBe(2)
  })

  it('act tab clicks only respond for visible acts', () => {
    const wp = new WorldPanelsHud()
    const cbs = { onClose: vi.fn(), onWaypointTeleport: vi.fn() }

    // Tab 2 strip slot (ox + 4 + 62 .. +124, oy + 8..59) is dead on a fresh Act 1 char:
    // the panel consumes the click but the hidden tab never becomes selected.
    const hidden = wp.handleLeftDockClick('waypoint', OX + 4 + 62 + 10, OY + 20, cbs)
    expect(hidden).toBe(true)
    expect(wp.selectedActTab).toBe(1)

    // Standing in Act 2, the same slot becomes clickable.
    wp.setCurrentLevel(40)
    const visible = wp.handleLeftDockClick('waypoint', OX + 4 + 62 + 10, OY + 20, cbs)
    expect(visible).toBe(true)
    expect(wp.selectedActTab).toBe(2)
  })

  it('drawActTabs renders only the visible tabs and clamps a stale selection', () => {
    const wp = new WorldPanelsHud()
    const tabsImg = { complete: true, naturalWidth: 630, naturalHeight: 31 } as unknown as HTMLImageElement
    const draws: any[] = []
    const ctx = {
      drawImage: vi.fn((...args: any[]) => draws.push(args)),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 60 })),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    wp.selectedActTab = 1
    wp.drawLeftDockPanel(
      ctx,
      'quest',
      { questTabsImg: tabsImg, questBgImg: null, buySellBtnImg: null } as any,
      { measureText: () => ({ width: 60 }), drawText: vi.fn() } as any,
    )
    let tabDraws = draws.filter(c => c[0] === tabsImg && c[4] === ACT_TAB_LAYOUT.height)
    expect(tabDraws.length).toBe(1)
    expect(tabDraws[0]![1]).toBe(0) // Act I active frame

    // Stale selection beyond the visible set is clamped back onto the last visible tab.
    wp.setCurrentLevel(75)
    wp.selectedActTab = 5
    draws.length = 0
    wp.drawLeftDockPanel(
      ctx,
      'quest',
      { questTabsImg: tabsImg, questBgImg: null, buySellBtnImg: null } as any,
      { measureText: () => ({ width: 60 }), drawText: vi.fn() } as any,
    )
    tabDraws = draws.filter(c => c[0] === tabsImg && c[4] === ACT_TAB_LAYOUT.height)
    expect(tabDraws.length).toBe(3)
    expect(wp.selectedActTab).toBe(3)
    expect(wp.selectedQuestIdx).toBe(-1)
  })
})

describe('Issue #933: waypoint rows (press depresses, release teleports)', () => {
  it('mouse-down latches the depressed icon and mouse-up inside fires the teleport', () => {
    const wp = new WorldPanelsHud()
    wp.setCurrentWaypoint(0, 1) // standing at Rogue Encampment (current)
    wp.setWaypointUnlocked(1, true) // Cold Plains unlocked destination
    const onWaypointTeleport = vi.fn()
    const onClose = vi.fn()
    const cbs = { onWaypointTeleport, onClose }

    // Row 1 (Cold Plains): press consumes the click without teleporting.
    expect(wp.handleLeftDockClick('waypoint', OX + 50, rowY(1) + 10, cbs)).toBe(true)
    expect(wp.pressedWaypointIdx).toBe(1)
    expect(onWaypointTeleport).not.toHaveBeenCalled()

    // Release back on the same row fires teleport + close exactly once.
    expect(wp.releaseWaypointButton(OX + 50, rowY(1) + 10)).toBe(true)
    expect(wp.pressedWaypointIdx).toBeNull()
    expect(onWaypointTeleport).toHaveBeenCalledTimes(1)
    expect(onWaypointTeleport).toHaveBeenCalledWith(1, 'cold-plains', 3)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('releasing off the row cancels the teleport', () => {
    const wp = new WorldPanelsHud()
    wp.setCurrentWaypoint(0, 1)
    wp.setWaypointUnlocked(1, true)
    const onWaypointTeleport = vi.fn()
    const cbs = { onWaypointTeleport, onClose: vi.fn() }

    wp.handleLeftDockClick('waypoint', OX + 50, rowY(1) + 10, cbs)
    expect(wp.pressedWaypointIdx).toBe(1)
    // Release over a different row (row 2): cancelled.
    expect(wp.releaseWaypointButton(OX + 50, rowY(2) + 10)).toBe(false)
    expect(wp.pressedWaypointIdx).toBeNull()
    expect(onWaypointTeleport).not.toHaveBeenCalled()
  })

  it('locked and current waypoint rows never latch or teleport', () => {
    const wp = new WorldPanelsHud()
    wp.setCurrentWaypoint(0, 1) // row 0 = current, everything else locked
    const onWaypointTeleport = vi.fn()
    const cbs = { onWaypointTeleport, onClose: vi.fn() }

    // Current row (Rogue Encampment): consumed, no latch.
    expect(wp.handleLeftDockClick('waypoint', OX + 50, rowY(0) + 10, cbs)).toBe(true)
    expect(wp.pressedWaypointIdx).toBeNull()

    // Locked row (Cold Plains): consumed, no latch.
    expect(wp.handleLeftDockClick('waypoint', OX + 50, rowY(1) + 10, cbs)).toBe(true)
    expect(wp.pressedWaypointIdx).toBeNull()
    expect(onWaypointTeleport).not.toHaveBeenCalled()
  })

  it('cancelCloseButton drops a held waypoint row (panel closed via another path)', () => {
    const wp = new WorldPanelsHud()
    wp.setCurrentWaypoint(0, 1)
    wp.setWaypointUnlocked(1, true)
    const onWaypointTeleport = vi.fn()
    wp.handleLeftDockClick('waypoint', OX + 50, rowY(1) + 10, {
      onWaypointTeleport,
      onClose: vi.fn(),
    })
    expect(wp.pressedWaypointIdx).toBe(1)

    wp.cancelCloseButton()
    expect(wp.pressedWaypointIdx).toBeNull()
    expect(wp.releaseWaypointButton(OX + 50, rowY(1) + 10)).toBe(false)
    expect(onWaypointTeleport).not.toHaveBeenCalled()
  })
})
