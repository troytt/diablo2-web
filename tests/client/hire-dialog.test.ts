import { describe, it, expect, vi } from 'vitest'
import type { D2FontRenderer } from '../../src/client/ui/font.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import {
  WorldPanelsHud,
  HIRE_DIALOG_WIDTH,
  HIRE_DIALOG_HEIGHT,
  HIRE_CONFIRM_WIDTH,
  HIRE_CONFIRM_HEIGHT,
} from '../../src/client/ui/world-panels.ts'
import { resolveHirelingCandidates } from '../../src/common/units/hireling-table.ts'

function createMockCtx() {
  const drawnTexts: string[] = []
  let fillRectCount = 0
  let strokeRectCount = 0
  return {
    drawnTexts,
    get fillRectCount() {
      return fillRectCount
    },
    get strokeRectCount() {
      return strokeRectCount
    },
    fillStyle: '',
    strokeStyle: '',
    fillRect: vi.fn(() => fillRectCount++),
    strokeRect: vi.fn(() => strokeRectCount++),
    fillText: vi.fn((text: string) => drawnTexts.push(text)),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D & {
    drawnTexts: string[]
    fillRectCount: number
    strokeRectCount: number
  }
}

function createMockFont() {
  const fontTexts: string[] = []
  const mockFont = {
    fontTexts,
    isLoaded: vi.fn(() => true),
    hasFont: vi.fn((name: string) => name === 'font16' || name === 'fontformal12'),
    drawText: vi.fn((_ctx: unknown, text: string) => {
      fontTexts.push(text)
    }),
    measureText: vi.fn((text: string) => text.length * 8),
    getLineHeight: vi.fn(() => 16),
  }
  return mockFont as unknown as D2FontRenderer & {
    fontTexts: string[]
    drawText: ReturnType<typeof vi.fn>
  }
}

describe('WorldPanelsHud — Mercenary Hire Stone Dialog (0x6faf9440 & 0x6faf7500 parity)', () => {
  it('identifies dialog hitboxes accurately per D2Client.dll 0x6faf9440 including full 490x350 interception when confirm is open', () => {
    const wp = new WorldPanelsHud()
    wp.activePanel = 'hire'

    // Centered at 155, 105 (490x350)
    expect(HIRE_DIALOG_WIDTH).toBe(490)
    expect(HIRE_DIALOG_HEIGHT).toBe(350)
    expect(HIRE_CONFIRM_WIDTH).toBe(300)
    expect(HIRE_CONFIRM_HEIGHT).toBe(160)
    expect(wp.isPointInHireMercDialog(100, 50)).toBe(false)
    expect(wp.isPointInHireMercDialog(155, 105)).toBe(true)
    expect(wp.isPointInHireMercDialog(400, 300)).toBe(true)
    expect(wp.isPointInHireMercDialog(644, 454)).toBe(true)
    expect(wp.isPointInHireMercDialog(650, 460)).toBe(false)

    // When confirmation dialog is open, the entire 490x350 Hire dialog remains intercepted
    // so clicks outside the 300x160 confirm box (e.g. (160,110), (180,250), (630,330)) never leak to world or rightPanel
    wp.replaceMercConfirmOpen = true
    expect(wp.isPointInHireMercDialog(100, 50)).toBe(false)
    expect(wp.isPointInHireMercDialog(160, 110)).toBe(true)
    expect(wp.isPointInHireMercDialog(180, 250)).toBe(true)
    expect(wp.isPointInHireMercDialog(250, 190)).toBe(true)
    expect(wp.isPointInHireMercDialog(400, 250)).toBe(true)
    expect(wp.isPointInHireMercDialog(550, 350)).toBe(true)
    expect(wp.isPointInHireMercDialog(630, 330)).toBe(true)
    expect(wp.isPointInHireMercDialog(650, 460)).toBe(false)
  })

  it('draws authentic 490x350 stone dialog with ItemDesc1s gold header and candidate list using D2FontRenderer exclusively (0 ctx.fillText calls)', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.activePanel = 'hire'
    wp.playerGold = 5000
    wp.stashGold = 12000

    const rawCandidates = [
      { nameId: 3411, seed: 0x1234 },
      { nameId: 3412, seed: 0x5678 },
    ]
    wp.mercHireList = resolveHirelingCandidates(rawCandidates, 10, 0, 0, true, 'ENG')

    const ctx = createMockCtx()
    const mockFont = createMockFont()
    wp.drawHireMercDialog(ctx, mockFont)

    expect(ctx.fillRectCount).toBeGreaterThan(0)
    // Zero ctx.fillText calls (single-layer D2FontRenderer only, no ghosting)
    expect(ctx.fillText).not.toHaveBeenCalled()
    expect(ctx.drawnTexts).toHaveLength(0)

    // Title with total gold 17000 drawn exactly once
    expect(
      mockFont.fontTexts.filter((t) => t.includes('17000') && t.includes('Hire which Mercenary?')),
    ).toHaveLength(1)
    // Candidates rendered with Lvl, Life, Def, Cost (and no extra "${cost} Gold" label)
    expect(mockFont.fontTexts.filter((t) => t.includes('Aliza - Lvl: 8'))).toHaveLength(1)
    expect(mockFont.fontTexts.some((t) => t.includes('Fire Arrow'))).toBe(true)
    expect(mockFont.fontTexts.some((t) => /\b\d+\s+Gold\b/.test(t))).toBe(false)
    // Bottom cancel button drawn once
    expect(mockFont.fontTexts.filter((t) => t === 'cancel')).toHaveLength(1)
  })

  it('fails fast with an explicit Error when D2FontRenderer, font16, or candidate fields are missing', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.activePanel = 'hire'
    wp.mercHireList = resolveHirelingCandidates([{ nameId: 3411, seed: 0x1234 }], 10, 0, 0, true, 'ENG')

    const ctx = createMockCtx()
    // Missing D2FontRenderer -> throws
    expect(() => wp.drawHireMercDialog(ctx, null)).toThrow(/D2FontRenderer/i)
    expect(() => wp.drawHireMercDialog(ctx)).toThrow(/D2FontRenderer/i)
    expect(ctx.fillText).not.toHaveBeenCalled()

    // Missing font16 in D2FontRenderer -> throws
    const fontMissingFont16 = {
      drawText: vi.fn(),
      hasFont: (name: string) => name !== 'font16',
    } as unknown as D2FontRenderer
    expect(() => wp.drawHireMercDialog(ctx, fontMissingFont16)).toThrow(/font16/i)

    // Missing candidate fields when line1 is not pre-formatted -> throws
    wp.mercHireList = [{ nameId: 3411, name: 'Aliza', level: 8 }] // missing hp/defense/cost
    const validFont = createMockFont()
    expect(() => wp.drawHireMercDialog(ctx, validFont)).toThrow(/Missing required mercenary candidate fields/i)
  })

  it('draws ItemDesc1t when hire list is empty via D2FontRenderer with 0 ctx.fillText calls', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.activePanel = 'hire'
    wp.mercHireList = []

    const ctx = createMockCtx()
    const mockFont = createMockFont()
    wp.drawHireMercDialog(ctx, mockFont)

    expect(ctx.fillText).not.toHaveBeenCalled()
    expect(
      mockFont.fontTexts.filter((t) => t.includes('There are no Mercenaries left to hire.')),
    ).toHaveLength(1)
  })

  it('handles candidate hover, scrolling, and direct hire when player has no existing mercenary', () => {
    const wp = new WorldPanelsHud()
    wp.activePanel = 'hire'
    wp.activeNpcId = 150

    const rawCandidates = Array.from({ length: 10 }, (_, i) => ({
      nameId: 3411 + i,
      seed: 0x1000 + i * 0x100,
    }))
    wp.mercHireList = resolveHirelingCandidates(rawCandidates, 15, 0, 0, true, 'ENG')

    // 1. Wheel scroll
    expect(wp.handleHireWheel(1)).toBe(true)
    expect(wp.hireScrollOffset).toBe(1)
    expect(wp.handleHireWheel(-1)).toBe(true)
    expect(wp.hireScrollOffset).toBe(0)

    // 2. Mouse move hover
    wp.handleHireMercMove(200, 160) // over Candidate 0
    expect(wp.hireHoveredIndex).toBe(0)

    // 3. Direct click to hire when player has no existing mercenary
    const onHireMerc = vi.fn()
    const handled = wp.handleHireMercClick(200, 160, { onHireMerc })
    expect(handled).toBe(true)
    expect(onHireMerc).toHaveBeenCalledWith(150, 3411)
    expect(wp.activePanel).toBe('none')
  })

  it('prompts confirmation dialog when player already possesses a mercenary (0x6faf7500) and renders via D2FontRenderer', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.activePanel = 'hire'
    wp.activeNpcId = 150
    wp.merc = { mercId: 42, isDead: false } // Existing active mercenary

    const rawCandidates = [{ nameId: 3411, seed: 0x1234 }]
    wp.mercHireList = resolveHirelingCandidates(rawCandidates, 15, 0, 0, true, 'ENG')

    const onHireMerc = vi.fn()

    // First click: selects candidate
    wp.handleHireMercClick(200, 160, { onHireMerc })
    expect(wp.hireSelectedIndex).toBe(0)
    expect(wp.replaceMercConfirmOpen).toBe(false)
    expect(onHireMerc).not.toHaveBeenCalled()

    // Second click on selected candidate: triggers replacement warning dialog
    wp.handleHireMercClick(200, 160, { onHireMerc })
    expect(wp.replaceMercConfirmOpen).toBe(true)
    expect(wp.pendingHireCandidate?.nameId).toBe(3411)

    // Render with confirm dialog open
    const ctx = createMockCtx()
    const mockFont = createMockFont()
    wp.drawHireMercDialog(ctx, mockFont)
    expect(ctx.fillText).not.toHaveBeenCalled()
    expect(
      mockFont.fontTexts.some((t) => t.includes('This Mercenary will replace')),
    ).toBe(true)
    expect(mockFont.fontTexts.filter((t) => t === 'Yes')).toHaveLength(1)
    expect(mockFont.fontTexts.filter((t) => t === 'No')).toHaveLength(1)

    // Click "No" (cx + 150 = 400, cy + 128 = 318)
    wp.handleHireMercClick(400, 318, { onHireMerc })
    expect(wp.replaceMercConfirmOpen).toBe(false)
    expect(wp.activePanel).toBe('hire')
    expect(onHireMerc).not.toHaveBeenCalled()

    // Open again and click "Yes" (cx + 150 = 400, cy + 104 = 294)
    wp.handleHireMercClick(200, 160, { onHireMerc })
    expect(wp.replaceMercConfirmOpen).toBe(true)

    wp.handleHireMercClick(400, 294, { onHireMerc })
    expect(wp.replaceMercConfirmOpen).toBe(false)
    expect(onHireMerc).toHaveBeenCalledWith(150, 3411)
    expect(wp.activePanel).toBe('none')
  })

  it('clicking cancel button closes hire dialog and re-opens NPC menu (0x6faf9090)', () => {
    const wp = new WorldPanelsHud()
    wp.lang = 'ENG'
    wp.openNpcMenuByName('Kashya', 400, 220)
    expect(wp.npcMenu).not.toBeNull()

    wp.clickNpcMenuOption('hire')
    expect(wp.activePanel).toBe('hire')
    expect(wp.npcMenu).toBeNull()

    // Click Cancel button at dialogX + 245 = 400, dialogY + 315 = 420
    const onClose = vi.fn()
    wp.handleHireMercClick(400, 420, { onClose })

    expect(wp.activePanel).toBe('none')
    expect(onClose).toHaveBeenCalled()
    expect(wp.npcMenu).not.toBeNull()
    expect(wp.npcMenu?.npcName).toContain('Kashya')
  })

  it('routes right-half clicks (x > 400) and blocks confirm-dialog click penetration to world or rightPanel in HudManager', () => {
    const hud = new HudManager()
    const hiredCalls: Array<{ npcId: number; mercId: number }> = []
    let closedNpcCount = 0

    hud.commandSink = {
      hireMerc: (npcId: number, mercId: number) => {
        hiredCalls.push({ npcId, mercId })
      },
      closeActiveNpcPanel: () => {
        closedNpcCount += 1
      },
    } as any

    const rawCandidates = Array.from({ length: 9 }, (_, i) => ({
      nameId: 3411 + i,
      seed: 0x1000 + i * 0x100,
    }))
    hud.worldPanels.mercHireList = resolveHirelingCandidates(rawCandidates, 15, 0, 0, true, 'ENG')
    hud.worldPanels.activePanel = 'hire'
    hud.worldPanels.activeNpcId = 150
    hud.leftPanel = 'hire'
    hud.rightPanel = 'inv'

    // 1. Scrollbar down arrow at x = 627..639 (x > 400)
    hud.handleClick(630, 422, 0)
    expect(hud.worldPanels.hireScrollOffset).toBe(1)

    // 2. When replaceMercConfirmOpen is true, clicking inside the 490x350 Hire dialog outside the 300x160 confirm box
    // at (180, 250) and (630, 330) must be intercepted by Hire dialog and NOT close rightPanel ('inv') at (630, 330)
    hud.worldPanels.replaceMercConfirmOpen = true
    hud.worldPanels.pendingHireCandidate = hud.worldPanels.mercHireList[0]
    expect(hud.isPointInterceptedByHud(180, 250)).toBe(true)
    expect(hud.isPointInterceptedByHud(630, 330)).toBe(true)

    hud.handleClick(180, 250, 0)
    expect(hud.worldPanels.replaceMercConfirmOpen).toBe(true)
    expect(hud.rightPanel).toBe('inv')

    hud.handleClick(630, 330, 0)
    expect(hud.worldPanels.replaceMercConfirmOpen).toBe(true)
    expect(hud.rightPanel).toBe('inv')

    // 3. Dismiss confirm, then click right half of candidate row 0 at x = 520, y = 165 (x > 400)
    hud.worldPanels.replaceMercConfirmOpen = false
    hud.worldPanels.pendingHireCandidate = null
    hud.handleClick(520, 165, 0)
    expect(hiredCalls).toEqual([{ npcId: 150, mercId: 3412 }])
    expect(hud.leftPanel).toBe('none')

    // 4. Reopen and click right half of Cancel button at x = 450, y = 420 (x > 400)
    hud.worldPanels.activePanel = 'hire'
    hud.worldPanels.activeNpcId = 150
    hud.leftPanel = 'hire'
    hud.handleClick(450, 420, 0)
    expect(hud.leftPanel).toBe('none')
    expect(closedNpcCount).toBe(1)
  })
})
