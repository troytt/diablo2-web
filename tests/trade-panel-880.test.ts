import { describe, expect, it, vi } from 'vitest'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { ClickButtonId, encodeC2sClickButton } from '../src/netproto/d2gs/c2s/interact.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'

function createMockCanvasCtx() {
  const drawImageCalls: unknown[][] = []
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: unknown }> = []
  const strokeRectCalls: unknown[][] = []
  const ctx: any = {
    fillStyle: '#000',
    strokeStyle: '#000',
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => {
      drawImageCalls.push(args)
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({ x, y, w, h, fillStyle: ctx.fillStyle })
    }),
    strokeRect: vi.fn((...args: unknown[]) => {
      strokeRectCalls.push(args)
    }),
    fillText: vi.fn(),
    measureText: vi.fn((t: string) => ({ width: t.length * 8 })),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  }
  return { ctx: ctx as CanvasRenderingContext2D, drawImageCalls, fillRectCalls, strokeRectCalls }
}

describe('Issue #880: 1.13c Player-to-Player Trade UI & State Machine', () => {
  it('registers tradeBg, tradeBtn, and goldCoinBtn in BAKED_UI_MANIFEST.images', () => {
    expect(BAKED_UI_MANIFEST.images.tradeBg).toBe('/ui/trade-bg.png')
    expect(BAKED_UI_MANIFEST.images.tradeBtn).toBe('/ui/tradebtn.png')
    expect(BAKED_UI_MANIFEST.images.goldCoinBtn).toBe('/ui/goldcoinbtn.png')
  })

  it('defines 1.13c ClickButtonId constants with TradeAccept = 0x03 (D2Game.dll 0x6fc94200)', () => {
    expect(ClickButtonId.TradeCancel).toBe(0x02)
    expect(ClickButtonId.TradeAccept).toBe(0x03)
    expect(ClickButtonId.TradeOk).toBe(0x04)
    expect(ClickButtonId.TradeUnaccept).toBe(0x07)
    expect(ClickButtonId.TradeGold).toBe(0x08)

    const pkt = encodeC2sClickButton(ClickButtonId.TradeAccept, 0)
    expect(Array.from(pkt)).toEqual([0x4f, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00])
  })

  it('transitions ClientWorld trade state accurately across S2C 0x77 / 0x78 / 0x79 / 0x92', () => {
    const world = new ClientWorld()

    // 0x77 action 0x00: RequestTrade -> initiator waiting modal
    world.apply({ type: 'Trade', action: 0x00 } as any)
    expect(world.trade.pendingModal).toBe('wait')
    expect(world.trade.active).toBe(false)

    // 0x77 action 0x01: TargetTradeRequest -> target invitation modal
    world.apply({ type: 'Trade', action: 0x01, partnerName: 'Tyrael', partnerId: 42 } as any)
    expect(world.trade.pendingModal).toBe('request')
    expect(world.trade.partnerName).toBe('Tyrael')
    expect(world.trade.partnerId).toBe(42)

    // 0x78: TradeAccepted -> opens trade session & clears pending modal
    world.apply({ type: 'Trade', action: 0x78, partnerName: 'AkaraHero', partnerId: 77 } as any)
    expect(world.trade.active).toBe(true)
    expect(world.trade.pendingModal).toBeNull()
    expect(world.trade.partnerName).toBe('AkaraHero')
    expect(world.trade.partnerId).toBe(77)
    expect(world.trade.selfAccepted).toBe(false)
    expect(world.trade.partnerAccepted).toBe(false)

    // 0x79 GoldInTrade: partner (low byte 0) and self (low byte 1)
    world.apply({ type: 'Trade', action: 0x7900, gold: 12500 } as any)
    world.apply({ type: 'Trade', action: 0x7901, gold: 5000 } as any)
    expect(world.trade.partnerGold).toBe(12500)
    expect(world.trade.selfGold).toBe(5000)

    // 0x77 action 0x04 (selfAccepted) & 0x05 (partnerAccepted)
    world.apply({ type: 'Trade', action: 0x04 } as any)
    expect(world.trade.selfAccepted).toBe(true)
    world.apply({ type: 'Trade', action: 0x05 } as any)
    expect(world.trade.partnerAccepted).toBe(true)

    // 0x77 action 0x06: OpenTrade / ResetCheckmarks keeps trade open and resets checkmarks
    world.apply({ type: 'Trade', action: 0x06 } as any)
    expect(world.trade.active).toBe(true)
    expect(world.trade.selfAccepted).toBe(false)
    expect(world.trade.partnerAccepted).toBe(false)

    // 0x77 action 0x0e: DisableAcceptButton sets acceptDisabled and clears checkmarks
    world.apply({ type: 'Trade', action: 0x04 } as any)
    world.apply({ type: 'Trade', action: 0x05 } as any)
    world.apply({ type: 'Trade', action: 0x0e } as any)
    expect(world.trade.acceptDisabled).toBe(true)
    expect(world.trade.selfAccepted).toBe(false)
    expect(world.trade.partnerAccepted).toBe(false)

    // While acceptDisabled is true, 0x04/0x05 cannot check accept
    world.apply({ type: 'Trade', action: 0x04 } as any)
    expect(world.trade.selfAccepted).toBe(false)

    // 0x77 action 0x0f: EnableAcceptButton clears lockout
    world.apply({ type: 'Trade', action: 0x0f } as any)
    expect(world.trade.acceptDisabled).toBe(false)
    world.apply({ type: 'Trade', action: 0x04 } as any)
    expect(world.trade.selfAccepted).toBe(true)

    // 0x77 action 0x07..0x0a: NoRoom / NotEnoughGold unchecks both without closing trade
    world.apply({ type: 'Trade', action: 0x08 } as any)
    expect(world.trade.active).toBe(true)
    expect(world.trade.selfAccepted).toBe(false)
    expect(world.trade.partnerAccepted).toBe(false)

    // 0x77 action 0x0c: CloseTrade closes trade and resets gold
    world.apply({ type: 'Trade', action: 0x0c } as any)
    expect(world.trade.active).toBe(false)
    expect(world.trade.partnerGold).toBe(0)
    expect(world.trade.selfGold).toBe(0)
  })

  it('supports GoldDialogMode = 2 (Trade Gold) in HudManager and unchecks accept before sending 0x4F 0x08', () => {
    const hud = new HudManager()
    hud.leftPanel = 'trade'
    hud.inventory.gold = 45000
    const tradeClicks: Array<{ buttonId: number; complement: number }> = []
    ;(hud.worldPanels as any).onTradeButtonClick = (buttonId: number, complement = 0) => {
      tradeClicks.push({ buttonId, complement })
    }
    ;(hud as any).trade = {
      active: true,
      selfGold: 1000,
      myGold: 1000,
      partnerGold: 0,
      selfAccepted: true,
      myAccepted: true,
      partnerAccepted: false,
      acceptDisabled: false,
    }

    hud.openGoldDialog(2)
    expect(hud.goldDialog?.mode).toBe(2)
    expect(hud.goldDialog?.amount).toBe(45000)

    hud.typeGoldDialogKey('9')
    hud.typeGoldDialogKey('5')
    hud.typeGoldDialogKey('0')
    hud.typeGoldDialogKey('0')
    expect(hud.goldDialog?.amount).toBe(9500)

    hud.confirmGoldDialog()
    expect(hud.goldDialog).toBeNull()
    expect(tradeClicks).toEqual([
      { buttonId: 0x07, complement: 0 },
      { buttonId: 0x08, complement: 9500 },
    ])
    expect((hud as any).trade.selfGold).toBe(9500)
    expect((hud as any).trade.selfAccepted).toBe(false)
  })

  it('renders authentic 1.13c trade.dc6 panel, checkmarks, lockout overlay, and handles modal/button clicks', () => {
    const wp = new WorldPanelsHud()
    wp.activePanel = 'trade'
    const buttonClicks: Array<{ buttonId: number; complement: number }> = []
    wp.onTradeButtonClick = (buttonId, complement = 0) => {
      buttonClicks.push({ buttonId, complement })
    }

    // 1. Pending invitation modal ('request')
    wp.trade = {
      active: false,
      pendingModal: 'request',
      partnerName: 'Deckard',
      selfName: 'Sorceress',
      partnerGold: 0,
      selfGold: 0,
      selfAccepted: false,
      partnerAccepted: false,
      acceptDisabled: false,
    }
    const modalLayout = wp.getPendingTradeModalLayout(800, 600)
    expect(
      wp.handleActiveLeftPanelClick('trade', modalLayout.ok.x + 10, modalLayout.ok.y + 10),
    ).toBe(true)
    expect(buttonClicks).toEqual([{ buttonId: 0x03, complement: 0 }])

    // 2. Active trade panel rendering & interaction
    buttonClicks.length = 0
    wp.trade = {
      active: true,
      pendingModal: null,
      partnerName: 'PaladinPartner',
      selfName: 'SorceressHero',
      partnerGold: 25000,
      selfGold: 10000,
      selfAccepted: false,
      partnerAccepted: true,
      acceptDisabled: true,
      partnerItems: [
        {
          id: 'p-1',
          code: 'rin',
          name: 'Ring',
          gridX: 0,
          gridY: 0,
          invWidth: 1,
          invHeight: 1,
        },
      ],
      selfItems: [
        {
          id: 's-1',
          code: 'amu',
          name: 'Amulet',
          gridX: 2,
          gridY: 1,
          invWidth: 1,
          invHeight: 1,
        },
      ],
    }

    const { ctx, drawImageCalls, fillRectCalls } = createMockCanvasCtx()
    wp.renderActiveLeftPanel(ctx, 'trade', null, {}, 800, 600)

    // Drawn tradeBgImg at (80, 60, 320, 432) and buySellBtnImg frames
    expect(drawImageCalls.length).toBeGreaterThanOrEqual(4)
    // Red lockout overlay at (ox + 223, oy + 384, 32, 32) = (303, 444, 32, 32)
    expect(
      fillRectCalls.some(
        c =>
          c.x === 80 + 223 &&
          c.y === 60 + 384 &&
          c.w === 32 &&
          c.h === 32 &&
          String(c.fillStyle).includes('180, 0, 0'),
      ),
    ).toBe(true)

    // Clicking self accept button while acceptDisabled = true should be blocked
    wp.handleActiveLeftPanelClick('trade', 80 + 235, 60 + 395)
    expect(buttonClicks).toEqual([])

    // Enable accept button -> clicking self accept sends 0x04 (TradeOk), clicking again sends 0x07 (TradeUnaccept)
    wp.trade.acceptDisabled = false
    wp.handleActiveLeftPanelClick('trade', 80 + 235, 60 + 395)
    expect(buttonClicks).toEqual([{ buttonId: 0x04, complement: 0 }])
    wp.handleActiveLeftPanelClick('trade', 80 + 235, 60 + 395)
    expect(buttonClicks).toEqual([
      { buttonId: 0x04, complement: 0 },
      { buttonId: 0x07, complement: 0 },
    ])

    // Clicking Cancel [X] button at (ox + 275, oy + 384) sends 0x02 (TradeCancel)
    buttonClicks.length = 0
    wp.handleActiveLeftPanelClick('trade', 80 + 285, 60 + 395)
    expect(buttonClicks).toEqual([{ buttonId: 0x02, complement: 0 }])

    // Hovering item in partner grid (ox + 18, oy + 36) and self grid (ox + 18, oy + 252)
    wp.handleMouseMove(80 + 18 + 5, 60 + 36 + 5)
    expect(wp.hoveredTradeItem?.item.code).toBe('rin')
    wp.handleMouseMove(80 + 18 + 2 * 29 + 5, 60 + 252 + 1 * 29 + 5)
    expect(wp.hoveredTradeItem?.item.code).toBe('amu')
  })
})
