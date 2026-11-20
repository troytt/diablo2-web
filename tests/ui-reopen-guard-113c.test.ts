/**
 * #1577: D2Client.dll 0x6FB6E2E0 arms a 100 ms guard (0x6FBAAD50) on every panel toggle/close;
 * 0x6FB71AEB refuses to open the chat box / game menu until it expires.
 */
import { describe, expect, it } from 'vitest'
import { HudManager } from '../src/client/ui/hud-manager.ts'

describe('chat / game menu reopen guard', () => {
  it('blocks for 100 ms after a panel toggle', () => {
    const hud = new HudManager()
    const t0 = performance.now()
    hud.toggleRightPanel('inv')
    expect(hud.isChatOrMenuOpenBlocked113c(t0 + 50)).toBe(true)
    expect(hud.isChatOrMenuOpenBlocked113c(hud.uiReopenGuardUntilMs)).toBe(false)
    expect(hud.isChatOrMenuOpenBlocked113c(hud.uiReopenGuardUntilMs + 1)).toBe(false)
  })

  it('a fresh HUD does not block', () => {
    expect(new HudManager().isChatOrMenuOpenBlocked113c()).toBe(false)
  })
})
