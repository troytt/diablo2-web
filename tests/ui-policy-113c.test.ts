/**
 * #1556 / #1562: D2Client.dll UI policy matrix (0x6FB8D538, applied by 0x6FB71A80).
 */
import { describe, expect, it } from 'vitest'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { decideUiOpen113c, UI_113C, uiPolicy113c } from '../src/client/ui/ui-policy-113c.ts'

function hudWithStash(): HudManager {
  const hud = new HudManager()
  hud.toggleLeftPanel('stash')
  return hud
}

describe('ui-policy-113c matrix', () => {
  it('diagonal: an open UI refuses to be opened again (policy 2/3)', () => {
    for (const id of [UI_113C.inventory, UI_113C.character, UI_113C.skillTree, UI_113C.stash]) {
      expect(uiPolicy113c(id, id)).toBeGreaterThanOrEqual(2)
    }
  })

  it('stash/cube/trade refuse character, skill tree, quest, party, waypoint, hireling, automap', () => {
    for (const open of [UI_113C.stash, UI_113C.cube, UI_113C.trade]) {
      for (const n of [
        UI_113C.character,
        UI_113C.skillTree,
        UI_113C.questLog,
        UI_113C.party,
        UI_113C.waypoint,
        UI_113C.hireling,
        UI_113C.automap,
      ]) {
        expect(decideUiOpen113c([open], n).allowed).toBe(false)
      }
      expect(decideUiOpen113c([open], UI_113C.chat).allowed).toBe(true)
      expect(decideUiOpen113c([open], UI_113C.belt).allowed).toBe(true)
    }
    // NPC shop allows the automap (row 0x0C col 0x0A = 0)
    expect(decideUiOpen113c([UI_113C.npcShop], UI_113C.automap).allowed).toBe(true)
  })

  it('opening the inventory closes the waypoint window; opening the skill tree closes the inventory', () => {
    expect(decideUiOpen113c([UI_113C.waypoint], UI_113C.inventory)).toEqual({
      allowed: true,
      close: [UI_113C.waypoint],
      cancelNpc: false,
    })
    expect(decideUiOpen113c([UI_113C.inventory], UI_113C.skillTree).close).toEqual([UI_113C.inventory])
    expect(decideUiOpen113c([UI_113C.inventory], UI_113C.character).close).toEqual([])
  })
})

describe('HudManager applies the policy matrix', () => {
  it('stash open: C / T / Q / P do not replace the stash, I does not strip its inventory', () => {
    const hud = hudWithStash()
    expect(hud.leftPanel).toBe('stash')
    expect(hud.rightPanel).toBe('inv')
    hud.toggleLeftPanel('char')
    hud.toggleLeftPanel('quest')
    hud.toggleLeftPanel('party')
    hud.toggleRightPanel('skill')
    hud.toggleRightPanel('inv')
    expect(hud.leftPanel).toBe('stash')
    expect(hud.rightPanel).toBe('inv')
  })

  it('#1562: waypoint open + I -> waypoint closes, inventory opens', () => {
    const hud = new HudManager()
    hud.toggleLeftPanel('waypoint')
    expect(hud.leftPanel).toBe('waypoint')
    hud.toggleRightPanel('inv')
    expect(hud.rightPanel).toBe('inv')
    expect(hud.leftPanel).toBe('none')
  })

  it('character + inventory coexist; skill tree replaces inventory', () => {
    const hud = new HudManager()
    hud.toggleLeftPanel('char')
    hud.toggleRightPanel('inv')
    expect([hud.leftPanel, hud.rightPanel]).toEqual(['char', 'inv'])
    hud.toggleRightPanel('skill')
    expect([hud.leftPanel, hud.rightPanel]).toEqual(['char', 'skill'])
  })

  it('opening the stash closes an open skill tree before showing its inventory half', () => {
    const hud = new HudManager()
    hud.toggleRightPanel('skill')
    hud.toggleLeftPanel('stash')
    expect([hud.leftPanel, hud.rightPanel]).toEqual(['stash', 'inv'])
  })
})

describe('#1563 belt popup vs skill speed bar (matrix rows 0x1F / 3)', () => {
  it('opening the belt closes the speed bar and vice versa', () => {
    const hud = new HudManager()
    hud.toggleSkillSpeedBar113c()
    expect(hud.hotkeys.openPopup).toBe('right')
    hud.toggleBeltPopup113c()
    expect(hud.belt.lockedOpen).toBe(true)
    expect(hud.hotkeys.openPopup).toBeNull()
    hud.toggleSkillSpeedBar113c()
    expect(hud.hotkeys.openPopup).toBe('right')
    expect(hud.belt.lockedOpen).toBe(false)
  })

  it('opening the skill tree closes the belt popup', () => {
    const hud = new HudManager()
    hud.toggleBeltPopup113c()
    hud.toggleRightPanel('skill')
    expect(hud.belt.lockedOpen).toBe(false)
  })
})

describe('#1557 automap refused while stash/cube/trade are open', () => {
  it('HudManager reports the open UI ids the automap policy column is evaluated against', () => {
    const hud = hudWithStash()
    expect(hud.getOpenUiIds113c()).toContain(UI_113C.stash)
    expect(hud.getOpenUiIds113c()).not.toContain(UI_113C.inventory)
    expect(decideUiOpen113c(hud.getOpenUiIds113c(), UI_113C.automap).allowed).toBe(false)
  })
})
