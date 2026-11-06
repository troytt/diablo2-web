/**
 * #1555: D2Client.dll SetUIState 0x6FB72790 refuses to open / toggle UIs while the player is dead
 * (IsUnitDead 0x6FB55440); closing (state 1) still works.
 */
import { describe, expect, it } from 'vitest'
import { HudManager } from '../src/client/ui/hud-manager.ts'

describe('dead player UI lock', () => {
  it('panels, belt, speed bar and help do not open while dead', () => {
    const hud = new HudManager()
    hud.isDead = true
    hud.toggleLeftPanel('char')
    hud.toggleLeftPanel('quest')
    hud.toggleRightPanel('inv')
    hud.toggleRightPanel('skill')
    hud.toggleBeltPopup113c()
    hud.toggleSkillSpeedBar113c()
    hud.toggleHelpOverlay()
    expect(hud.leftPanel).toBe('none')
    expect(hud.rightPanel).toBe('none')
    expect(hud.belt.lockedOpen).toBe(false)
    expect(hud.hotkeys.openPopup).toBeNull()
    expect(hud.helpOverlayOpen).toBe(false)
  })

  it('a toggle while dead does not close an already-open panel; explicit close still works', () => {
    const hud = new HudManager()
    hud.toggleRightPanel('inv')
    hud.isDead = true
    hud.toggleRightPanel('inv')
    expect(hud.rightPanel).toBe('inv')
    hud.closeAllPanels()
    expect(hud.rightPanel).toBe('none')
  })

  it('alive again -> panels open normally', () => {
    const hud = new HudManager()
    hud.isDead = true
    hud.toggleLeftPanel('char')
    hud.isDead = false
    hud.toggleLeftPanel('char')
    expect(hud.leftPanel).toBe('char')
  })
})
