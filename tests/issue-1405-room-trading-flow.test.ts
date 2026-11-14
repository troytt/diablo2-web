import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { isPointInterceptedByHud } from '../src/client/ui/hud-input-router.ts'
import { VIEWPORT_1280x720, VIEWPORT_800x600 } from '../src/client/view/viewport-profile.ts'
import { resolveItemContainer } from '../src/netproto/d2gs/items/item-types.ts'
import { resolveTblKey } from '../src/common/data/canonical-tbl-strings.ts'

describe('Issue #1405: In-room player-to-player trading full flow parity', () => {
  it('intercepts centered pending trade modal (wait/request) across 800x600 and 1280x720 without blocking non-modal left dock', () => {
    const hud = new HudManager()
    hud.leftPanel = 'trade'
    ;(hud as any).trade = {
      active: false,
      pendingModal: 'request',
      partnerName: 'tt1',
    }
    ;(hud.worldPanels as any).trade = (hud as any).trade

    // 1. 1280x720 widescreen: modal is centered at x = 510..770, y = 282..392
    hud.setViewportProfile(VIEWPORT_1280x720)
    const layout1280 = hud.worldPanels.getPendingTradeModalLayout(1280, 720)
    expect(layout1280.x).toBe(510)
    // OK and Cancel buttons inside centered modal MUST be intercepted by HUD
    expect(isPointInterceptedByHud(hud, layout1280.ok.x + 10, layout1280.ok.y + 10)).toBe(true)
    expect(isPointInterceptedByHud(hud, layout1280.cancel.x + 10, layout1280.cancel.y + 10)).toBe(true)
    // Left dock (x = 150, y = 200) is NOT open while only pendingModal is shown
    expect(isPointInterceptedByHud(hud, 150, 200)).toBe(false)

    // 2. 800x600 standard: modal is centered at x = 270..530, y = 222..332
    hud.setViewportProfile(VIEWPORT_800x600)
    const layout800 = hud.worldPanels.getPendingTradeModalLayout(800, 600)
    expect(layout800.x).toBe(270)
    // Cancel button at x = 420..500 (> 400) MUST still be intercepted by HUD
    expect(isPointInterceptedByHud(hud, layout800.ok.x + 10, layout800.ok.y + 10)).toBe(true)
    expect(isPointInterceptedByHud(hud, layout800.cancel.x + 10, layout800.cancel.y + 10)).toBe(true)
    expect(isPointInterceptedByHud(hud, 150, 200)).toBe(false)
  })

  it('routes S2C 0x9C partner trade offer items (storePage === 2 / bInvPage === 1) to tradePartner and self trade items (storePage === 3 / bInvPage === 2) to tradeSelf', () => {
    const world = new ClientWorld()
    world.self.unitId = 101

    expect(resolveItemContainer(0x9c, 0x04, undefined, 0, 2)).toBe('trade')
    expect(resolveItemContainer(0x9c, 0x04, undefined, 0, 3)).toBe('trade')

    // Partner places an item into their trade box -> D2Game.dll clones to self pInventory on bInvPage=1 (storePage=2) via S2C 0x9C action=0x04 (no ownerId header)
    world.containers.applyItemEvent(
      0x04,
      {
        id: 9001,
        code: 'rin',
        name: 'Ring',
        action: 0x04,
        location: 0,
        storePage: 2,
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        flags: 0x10,
      } as any,
      'trade',
      101,
    )
    expect(world.containers.tradePartner.has(9001)).toBe(true)
    expect(world.containers.tradeSelf.has(9001)).toBe(false)

    // Local player places an item into self trade box -> storePage=3 (bInvPage=2)
    world.containers.applyItemEvent(
      0x04,
      {
        id: 9002,
        code: 'amu',
        name: 'Amulet',
        action: 0x04,
        location: 0,
        storePage: 3,
        x: 2,
        y: 1,
        width: 1,
        height: 1,
        flags: 0x10,
      } as any,
      'trade',
      101,
    )
    expect(world.containers.tradeSelf.has(9002)).toBe(true)
    expect(world.containers.tradePartner.has(9002)).toBe(false)

    // Partner removes item 9001 from trade -> action=0x05 RemoveFromContainer must remove from tradePartner and never put on local cursor
    world.containers.applyItemEvent(
      0x05,
      {
        id: 9001,
        code: 'rin',
        name: 'Ring',
        action: 0x05,
        location: 4,
        storePage: 0,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        flags: 0,
      } as any,
      'cursor',
      101,
    )
    expect(world.containers.tradePartner.has(9001)).toBe(false)
    expect(world.containers.cursor).toBeNull()
  })

  it('persists selfAccepted / pendingModal / selfGold in world.trade when clickButton is invoked so syncFromWorld does not overwrite them', () => {
    const world = new ClientWorld()
    const hud = new HudManager()
    const commands: any[] = []
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: cmd => commands.push(cmd),
    })

    // 1. Target receives trade request (0x77 0x01)
    world.apply({ type: 'Trade', action: 0x01, partnerName: 'tt1', partnerId: 11 } as any)
    model.syncFromWorld()
    expect((hud as any).trade.pendingModal).toBe('request')

    // Click OK (0x03) -> pendingModal cleared on world.trade and survives next syncFromWorld
    model.clickButton(0x03, 0)
    model.syncFromWorld()
    expect(world.trade.pendingModal).toBeNull()
    expect((hud as any).trade.pendingModal).toBeNull()

    // 2. Trade session opens (0x78)
    world.apply({ type: 'Trade', action: 0x78, partnerName: 'tt1', partnerId: 11 } as any)
    model.syncFromWorld()
    expect(hud.leftPanel).toBe('trade')
    expect(hud.rightPanel).toBe('inv')

    // Click Self Accept (0x04) -> D2GS does not echo 0x77 0x04 back to self, so world.trade.selfAccepted must be true immediately and survive syncFromWorld
    model.clickButton(0x04, 0)
    model.syncFromWorld()
    expect(world.trade.selfAccepted).toBe(true)
    expect((hud as any).trade.selfAccepted).toBe(true)

    // Click Self Unaccept (0x07) -> clears selfAccepted
    model.clickButton(0x07, 0)
    model.syncFromWorld()
    expect(world.trade.selfAccepted).toBe(false)
    expect((hud as any).trade.selfAccepted).toBe(false)

    // 3. Trade completes (0x77 0x0D) -> closes both left trade panel and right inventory panel
    world.apply({ type: 'Trade', action: 0x0d } as any)
    model.syncFromWorld()
    expect(hud.leftPanel).toBe('none')
    expect(hud.rightPanel).toBe('none')
    expect(hud.inventory.visible).toBe(false)
  })

  it('resolves canonical 1.13c string.tbl trade strings for ENG and CHI', () => {
    expect(resolveTblKey('strWaitingForOtherPlayer', 'ENG')).toBe('asking other player to trade')
    expect(resolveTblKey('strWaitingForOtherPlayer', 'CHI')).toBe('詢問另一位玩者的交易意願')
    expect(resolveTblKey('string#4042', 'ENG')).toBe('agree to trade')
    expect(resolveTblKey('string#4042', 'CHI')).toBe('同意進行交易')
    expect(resolveTblKey('strTradeGoldHowMuch', 'ENG')).toBe('How much Gold would you like to offer?')
    expect(resolveTblKey('strTradeGoldHowMuch', 'CHI')).toBe('你想要花多少錢來成交？')
    expect(resolveTblKey('string#4130', 'ENG')).toBe('Cancel')
    expect(resolveTblKey('string#4130', 'CHI')).toBe('取消')
    expect(resolveTblKey('string#4131', 'ENG')).toBe('Accept Trade')
    expect(resolveTblKey('string#4131', 'CHI')).toBe('接受交易')

    const hud = new HudManager()
    hud.lang = 'CHI'
    const drawnTexts: string[] = []
    vi.spyOn(hud.font, 'drawText').mockImplementation((_ctx, text) => {
      drawnTexts.push(text)
    })
    ;(hud.worldPanels as any).lang = 'CHI'
    hud.worldPanels.trade = {
      active: false,
      pendingModal: 'request',
      partnerName: 'tt1',
      selfName: 'tt2',
      partnerGold: 0,
      selfGold: 0,
      selfAccepted: false,
      partnerAccepted: false,
      acceptDisabled: false,
    }
    const mockCtx: any = {
      fillStyle: '#000',
      strokeStyle: '#000',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
    }
    hud.worldPanels.renderActiveLeftPanel(mockCtx, 'trade', hud.font, {}, 800, 600)
    expect(drawnTexts).toContain('tt1 同意進行交易')

    // When S2C 0x77 0x01 arrives before S2C 0x78 (no partnerName yet), D2Client.dll 0x6fb09ac0 renders #4042 directly without a fake 'Player' prefix
    drawnTexts.length = 0
    hud.worldPanels.trade = {
      ...hud.worldPanels.trade,
      partnerName: undefined,
    }
    hud.worldPanels.renderActiveLeftPanel(mockCtx, 'trade', hud.font, {}, 800, 600)
    expect(drawnTexts).toContain('同意進行交易')
    expect(drawnTexts.some(t => t.includes('Player'))).toBe(false)
  })
})
