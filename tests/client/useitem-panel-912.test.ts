/**
 * Issue #912: 1.13c `D2Client.dll` `UI\useitem.cpp` parity for the Charsi Imbue / Larzuk Add Sockets /
 * Anya Personalize window (useitem mode 1, `menu\upgrade.dc6`) and the Act 2 Horadric Orifice
 * (useitem mode 0, `menu\horadricback.dc6`). See `kb/ui/d2client-useitem-imbue-socket-orifice-113c.md`.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  USE_ITEM_BUTTON_TBL,
  USE_ITEM_INSTRUCTION_TBL,
  USE_ITEM_LAYOUT,
  WorldPanelsHud,
  hitTestUseItemButton,
  hitTestUseItemSlot,
  wrapUseItemText,
  type UseItemPanelKind,
} from '../../src/client/ui/world-panels.ts'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT } from '../../src/common/data/canonical-tbl-strings.ts'
import type { UiInventoryItem } from '../../src/client/ui/inventory.ts'
import { resolveItemSpriteRect } from '../../src/client/ui/inventory.ts'

const PANELS: readonly UseItemPanelKind[] = ['imbue', 'add_sockets', 'personalize', 'orifice']

function img(name: string): HTMLImageElement {
  return { src: `/ui/${name}.png`, complete: true, naturalWidth: 119, width: 119, height: 184 } as unknown as HTMLImageElement
}

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as any
}

function makeFont() {
  const calls: Array<{ text: string; x: number; y: number; opts: any }> = []
  const font = {
    loaded: true,
    drawText: (_ctx: unknown, text: string, x: number, y: number, opts: any) => calls.push({ text, x, y, opts }),
    measureText: (text: string) => text.length * 6,
    getFontMeta: () => ({ lineHeight: 16 }),
  } as any
  return { font, calls }
}

function makeItem(overrides: Record<string, unknown> = {}): UiInventoryItem {
  return {
    id: '101',
    code: 'ssd',
    name: 'Short Sword',
    quality: 'normal',
    invWidth: 1,
    invHeight: 3,
    invFile: 'invssd',
    identified: true,
    sockets: 0,
    stats: [],
    statsEn: [],
    ...overrides,
  } as unknown as UiInventoryItem
}

describe('Issue #912: useitem.cpp Imbue / Add Sockets / Personalize / Orifice UI (1.13c)', () => {
  it('pins the layout constants decoded from D2Client.dll 1.13c', () => {
    // 0x6fb4f4b6: DrawCellContextEx(inset, 0x69, 0x10e, -1, 5); both insets are 119x184.
    expect(USE_ITEM_LAYOUT.inset).toEqual({ x: 105, bottomY: 270, width: 119, height: 184 })
    // 0x6fb503ae..0x6fb503d2
    expect(USE_ITEM_LAYOUT.slot).toEqual({ left: 123, right: 211, top: 106, bottom: 220 })
    // .data 0x6fb8ec60 button table
    expect(USE_ITEM_LAYOUT.buttons.map((b) => [b.drawX, b.drawY, b.left, b.right, b.top, b.bottom, b.frame])).toEqual([
      [122, 256, 122, 154, 224, 256, 16],
      [177, 256, 177, 209, 224, 256, 10],
    ])
    expect(USE_ITEM_LAYOUT.text).toEqual({ centerX: 160, firstBaselineY: 30, lineStep: 20, wrapWidth: 300 })
  })

  it('emits the exact .tbl strings D2Client references by index', () => {
    expect(CANONICAL_ENG_TBL_DICT[USE_ITEM_INSTRUCTION_TBL.imbue]).toBe(
      'No Magic, Socketed, Rare, Unique, or Set Items. No Jewelry.',
    )
    expect(CANONICAL_ENG_TBL_DICT[USE_ITEM_INSTRUCTION_TBL.add_sockets]).toBe(
      'Choose the item to which you wish to add sockets.',
    )
    expect(CANONICAL_ENG_TBL_DICT[USE_ITEM_INSTRUCTION_TBL.personalize]).toBe(
      'Choose the item that you wish to personalize with your name.',
    )
    expect(PANELS.map((p) => USE_ITEM_BUTTON_TBL[p].map((k) => CANONICAL_ENG_TBL_DICT[k]))).toEqual([
      ['imbue', 'close'],
      ['add sockets', 'close'],
      ['personalize', 'close'],
      ['ok', 'close'],
    ])
    for (const p of PANELS) {
      for (const k of USE_ITEM_BUTTON_TBL[p]) expect(CANONICAL_CHI_TBL_DICT[k]).toBeTruthy()
    }
    for (const k of Object.values(USE_ITEM_INSTRUCTION_TBL)) expect(CANONICAL_CHI_TBL_DICT[k]).toBeTruthy()
  })

  it('bakes menu\\upgrade.dc6 next to menu\\horadricback.dc6', () => {
    expect(BAKED_UI_MANIFEST.images.upgradeBg).toBe('/ui/upgrade.png')
    expect(BAKED_UI_MANIFEST.images.horadricBg).toBe('/ui/horadricback.png')
  })

  it('hit-tests buttons and the item rect at absolute coordinates', () => {
    expect(hitTestUseItemButton(122, 224)).toBe(0)
    expect(hitTestUseItemButton(154, 256)).toBe(0)
    expect(hitTestUseItemButton(155, 240)).toBeNull()
    expect(hitTestUseItemButton(177, 240)).toBe(1)
    expect(hitTestUseItemButton(209, 256)).toBe(1)
    expect(hitTestUseItemButton(190, 223)).toBeNull()
    expect(hitTestUseItemSlot(123, 106)).toBe(true)
    expect(hitTestUseItemSlot(211, 220)).toBe(true)
    expect(hitTestUseItemSlot(122, 150)).toBe(false)
    expect(hitTestUseItemSlot(150, 221)).toBe(false)
  })

  for (const panel of PANELS) {
    it(`renders '${panel}' with only the inset, two buysellbtn buttons and (mode 1) the instruction text`, () => {
      for (const [w, h] of [
        [640, 480],
        [800, 600],
      ] as const) {
        const wp = new WorldPanelsHud()
        wp.lang = 'ENG'
        wp.activePanel = panel
        const ctx = makeCtx()
        const { font, calls } = makeFont()
        const upgrade = img('upgrade')
        const horadric = img('horadricback')
        const btn = img('buysellbtn')
        wp.renderActiveLeftPanel(
          ctx,
          panel,
          font,
          { upgradeBgImg: upgrade, horadricBgImg: horadric, buySellBtnImg: btn, itemsAtlasImg: img('items') },
          w,
          h,
        )
        // No placeholder 320x432 background / [X] button.
        expect(ctx.fillRect).not.toHaveBeenCalled()
        expect(ctx.strokeRect).not.toHaveBeenCalled()
        expect(ctx.drawImage.mock.calls).toEqual([
          [panel === 'orifice' ? horadric : upgrade, 105, 86, 119, 184],
          [btn, 16 * 32, 0, 32, 32, 122, 224, 32, 32],
          [btn, 10 * 32, 0, 32, 32, 177, 224, 32, 32],
        ])
        if (panel === 'orifice') {
          expect(calls).toEqual([])
        } else {
          const text = CANONICAL_ENG_TBL_DICT[USE_ITEM_INSTRUCTION_TBL[panel]]!
          const lines = wrapUseItemText(font, text, 300)
          expect(calls.map((c) => c.text)).toEqual(lines)
          lines.forEach((line, i) => {
            expect(calls[i]).toMatchObject({
              x: 160 - Math.trunc((line.length * 6) / 2),
              y: 30 + 20 * i,
              opts: { font: 'font16', color: 'gold' },
            })
          })
        }
      }
    })
  }

  it('draws the hover label box and pressed frame like 0x6fb4f590..0x6fb4f659', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.activePanel = 'add_sockets'
    wp.handleMouseMove(130, 240)
    expect(wp.hoveredUseItemButton).toBe(0)
    const ctx = makeCtx()
    const { font, calls } = makeFont()
    const btn = img('buysellbtn')
    wp.renderActiveLeftPanel(ctx, 'add_sockets', font, { upgradeBgImg: img('upgrade'), buySellBtnImg: btn }, 800, 600)
    const label = 'add sockets'
    const w = label.length * 6
    const half = Math.trunc(w / 2)
    expect(ctx.fillRect).toHaveBeenCalledWith(122 - half + 10, 256 - 16 - 42, w + 12, 16 + 6)
    expect(calls.at(-1)?.text).not.toBe(label) // instruction text is drawn after the label
    expect(calls.find((c) => c.text === label)).toMatchObject({
      x: 122 - half + 16,
      y: 256 - 38,
      opts: { font: 'font16', color: 'white' },
    })

    // Pressing the close button shows frame 11 until the mouse leaves it.
    wp.handleMouseMove(190, 240)
    wp.pressedUseItemButton = 1
    const ctx2 = makeCtx()
    wp.renderActiveLeftPanel(ctx2, 'add_sockets', font, { upgradeBgImg: img('upgrade'), buySellBtnImg: btn }, 800, 600)
    expect(ctx2.drawImage.mock.calls[2]).toEqual([btn, 11 * 32, 0, 32, 32, 177, 224, 32, 32])
    wp.handleMouseMove(20, 20)
    expect(wp.pressedUseItemButton).toBeNull()
    expect(wp.hoveredUseItemButton).toBeNull()
  })

  it('draws the placed item 1:1 centred at x = 167 - (w >> 1), y = 106 + ((114 - h) >> 1)', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.activePanel = 'imbue'
    const item = makeItem()
    wp.questRewardItem = item
    const ctx = makeCtx()
    const { font } = makeFont()
    const atlas = img('items')
    wp.renderActiveLeftPanel(
      ctx,
      'imbue',
      font,
      { upgradeBgImg: img('upgrade'), buySellBtnImg: img('buysellbtn'), itemsAtlasImg: atlas },
      800,
      600,
    )
    const rect = resolveItemSpriteRect(item, BAKED_UI_MANIFEST.itemRects)!
    expect(rect).toBeTruthy()
    const dy = 106 + (rect.h < 112 ? (114 - rect.h) >> 1 : 0)
    expect(ctx.drawImage).toHaveBeenCalledWith(atlas, rect.x, rect.y, rect.w, rect.h, 167 - (rect.w >> 1), dy, rect.w, rect.h)
  })

  it('places / swaps / returns items and confirms only via the absolute-coordinate buttons', () => {
    const wp = new WorldPanelsHud()
    wp.activePanel = 'orifice'
    const staff = makeItem({ id: '7', code: 'hst', name: 'Horadric Staff', invWidth: 1, invHeight: 4, invFile: 'invhst' })
    const inventory = { cursorItem: staff as UiInventoryItem | null }
    let confirmed: number | null = null
    let closed = false
    const cbs = {
      inventory,
      onConfirmQuestReward: (id: number) => {
        confirmed = id
      },
      onClose: () => {
        closed = true
      },
    }
    // Old placeholder confirm rect (ox+112..ox+208, oy+280..oy+312) no longer does anything.
    expect(wp.handleActiveLeftPanelClick('orifice', 80 + 150, 60 + 295, false, false, cbs)).toBe(true)
    expect(confirmed).toBeNull()
    // Drop the staff into the rect, then confirm.
    wp.handleActiveLeftPanelClick('orifice', 167, 160, false, false, cbs)
    expect(wp.questRewardItem).toBe(staff)
    expect(inventory.cursorItem).toBeNull()
    wp.handleActiveLeftPanelClick('orifice', 138, 240, false, false, cbs)
    expect(confirmed).toBe(7)
    expect(wp.activePanel).toBe('none')

    // Close returns the placed item to the cursor — 1.13c semantics (issue #927):
    // mouse-down latches the depressed cell, the close fires on mouse-up back on it.
    wp.activePanel = 'orifice'
    wp.questRewardItem = staff
    expect(wp.handleActiveLeftPanelClick('orifice', 193, 240, false, false, cbs)).toBe(true)
    expect(closed).toBe(false)
    expect(wp.hasPendingCloseRelease()).toBe(true)
    expect(wp.releaseCloseButton(193, 240, 193, 240)).toBe(true)
    expect(closed).toBe(true)
    expect(inventory.cursorItem).toBe(staff)
    expect(wp.questRewardItem).toBeNull()
  })
})
