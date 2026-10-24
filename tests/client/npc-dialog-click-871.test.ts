/**
 * Issue #871 — Regression tests for NPC dialog click failures and instant dismissal:
 * 1. Same-frame `mousedown` bubble self-dismissal (`_d2HandledByCommandMapper` guard between
 *    `CommandMapper.handlePointerDown` / `stageEl` and `HudManager`'s `window` `mousedown` listener)
 * 2. Canonical 1.13c D2Client NPC interaction range (ProcessClick 0x6facafea: `#10407` table distance
 *    0x6FDDABC0 `<= 2`) for two `size=2` units at `(3,0)`, `(3,1)`, `(2,2)` (no bogus `dist > 2.5` cutoff)
 * 3. In-range NPC click stops `predictor` without emitting `MoveToUnit`, suppresses 40ms hold-repeat while
 *    the same NPC menu is open, and keeps local state / predictor stopped inside the 200ms `c2sDedupe` window
 * 4. Integer subtile coordinate rounding parity (`Math.round`) between `CommandMapper` and `OnlineSession`,
 *    and world clicks during active `npcMenu.talking` speech scroll dismissing speech instead of walking/cancelling
 */

import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

describe('Issue #871 — NPC dialog click reliability & 1.13c interaction range parity', () => {
  function createSessionWithTownNpc(selfX = 5000, selfY = 5000, npcX = 5003, npcY = 5000) {
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1,
        name: 'Hero',
        x: selfX,
        y: selfY,
      },
    })
    const akaraId = 148
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: akaraId,
        classId: 148, // Akara (MonStats2 sizeX = 2)
        name: 'Akara',
        x: npcX,
        y: npcY,
        lifePct: 128,
        mode: 1,
      },
    })

    // Configure deterministic camera mapping so screen clicks map cleanly to world subtiles
    const camera = session.camera as unknown as {
      subtileToScreen: (x: number, y: number) => { x: number; y: number }
      screenToSubtile: (x: number, y: number) => { x: number; y: number }
    }
    camera.subtileToScreen = (x: number, y: number) => ({
      x: 400 + (x - selfX) * 16,
      y: 300 + (y - selfY) * 8,
    })
    camera.screenToSubtile = (x: number, y: number) => ({
      x: Math.round(selfX + (x - 400) / 16),
      y: Math.round(selfY + (y - 300) / 8),
    })

    return { session, akaraId }
  }

  it('1. 1.13c NPC interaction range (#10407 <= 2) offsets (3,0), (3,1), and (2,2) open npcMenu immediately without MoveToUnit and survive OnlineSession.tick()', () => {
    const contactOffsets: readonly [number, number][] = [
      [3, 0], // #10407 = 0x6FDDABC0[3 + 0 * 8] = 0
      [3, 1], // #10407 = 0x6FDDABC0[3 + 1 * 8] = 1
      [2, 2], // #10407 = 0x6FDDABC0[2 + 2 * 8] = 0
    ]

    for (const [dx, dy] of contactOffsets) {
      const { session, akaraId } = createSessionWithTownNpc(5000, 5000, 5000 + dx, 5000 + dy)
      const akaraUnit = session.world.getUnit('monster', akaraId)!

      const sentBefore = session.getSentCommands().length
      const record = session.commandMapper.triggerPrimaryWorldAction(
        akaraUnit.x,
        akaraUnit.y,
        akaraUnit,
        1000,
      )
      expect(record?.command).toEqual({
        type: 'NpcInit',
        target: { unitType: 1, id: akaraId },
      })

      const newCmds = session.getSentCommands().slice(sentBefore).map((c) => c.type)
      expect(newCmds).not.toContain('MoveToUnit')
      expect(newCmds).toContain('Interact')
      expect(newCmds).toContain('NpcInit')
      expect(session.predictor.getSnapshot().moving).toBe(false)
      expect(session.world.npcInteraction.npcId).toBe(akaraId)
      expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)

      // Subsequent 25 Hz ticks must NOT auto-cancel the dialog
      session.tick(1040)
      session.tick(1080)
      expect(session.world.npcInteraction.npcId).toBe(akaraId)
      expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
    }
  })

  it('2. same-frame mousedown bubble on viewCanvas does NOT self-dismiss npcMenu when CommandMapper opens it', () => {
    let windowMouseDownListener: ((e: MouseEvent) => void) | null = null
    const origWindow = globalThis.window
    const FakeCanvas = class {} as unknown as typeof HTMLCanvasElement
    const origHTMLCanvasElement = globalThis.HTMLCanvasElement
    ;(globalThis as unknown as { HTMLCanvasElement: unknown }).HTMLCanvasElement = FakeCanvas
    ;(globalThis as unknown as { window: unknown }).window = {
      addEventListener: (type: string, fn: (e: MouseEvent) => void) => {
        if (type === 'mousedown') windowMouseDownListener = fn
      },
      removeEventListener: () => {},
    }

    try {
      const { session, akaraId } = createSessionWithTownNpc(5000, 5000, 5003, 5000)
      const hudCanvas = Object.assign(new FakeCanvas(), {
        width: 800,
        height: 600,
        style: {},
        addEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      }) as unknown as HTMLCanvasElement
      const viewCanvas = Object.assign(new FakeCanvas(), {
        width: 800,
        height: 600,
      }) as unknown as HTMLCanvasElement

      ;(session.hudManager as unknown as { hudCanvas: HTMLCanvasElement }).hudCanvas = hudCanvas
      ;(session.hudManager as unknown as { bindEvents: () => void }).bindEvents()
      expect(windowMouseDownListener).not.toBeNull()

      const akaraUnit = session.world.getUnit('monster', akaraId)!
      session.commandMapper.setHoveredUnit(akaraUnit)

      // Click on Akara's body on viewCanvas (below the overhead npcMenu box at y - 150)
      const npcScreen = session.camera.subtileToScreen(akaraUnit.x, akaraUnit.y)
      const rawMouseEvent = {
        clientX: npcScreen.x,
        clientY: npcScreen.y,
        button: 0,
        shiftKey: false,
        defaultPrevented: false,
        target: viewCanvas,
        preventDefault: () => {
          rawMouseEvent.defaultPrevented = true
        },
      }
      const mouseEvent = rawMouseEvent as unknown as MouseEvent

      // 1. stageEl mousedown runs CommandMapper.handlePointerDown -> opens npcMenu synchronously
      session.commandMapper.handlePointerDown(mouseEvent, 2000)
      expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
      expect((mouseEvent as { _d2HandledByCommandMapper?: boolean })._d2HandledByCommandMapper).toBe(
        true,
      )

      // 2. Same mousedown event bubbles to window -> must NOT call dismissNpcMenu()
      windowMouseDownListener!(mouseEvent)
      expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
      expect(session.world.npcInteraction.npcId).toBe(akaraId)
    } finally {
      ;(globalThis as unknown as { window: unknown }).window = origWindow
      ;(globalThis as unknown as { HTMLCanvasElement: unknown }).HTMLCanvasElement =
        origHTMLCanvasElement
    }
  })

  it('3. holding left mouse (>40ms) or multi-clicking on an open NPC within 200ms c2sDedupe window does NOT start walking or cancel npcMenu', () => {
    const { session, akaraId } = createSessionWithTownNpc(5000, 5000, 5003, 5000)
    const akaraUnit = session.world.getUnit('monster', akaraId)!
    session.commandMapper.setHoveredUnit(akaraUnit)
    const npcScreen = session.camera.subtileToScreen(akaraUnit.x, akaraUnit.y)

    // Initial mousedown opens npcMenu
    session.commandMapper.handlePointerDown(npcScreen.x, npcScreen.y, 0, 3000)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
    expect(session.predictor.getSnapshot().moving).toBe(false)

    // Hold left mouse across multiple 40ms+ ticks
    const sentAfterOpen = session.getSentCommands().length
    session.tick(3050)
    session.tick(3100)
    session.tick(3150)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.predictor.getSnapshot().moving).toBe(false)
    expect(
      session
        .getSentCommands()
        .slice(sentAfterOpen)
        .filter((c) => c.type === 'MoveToUnit' || c.type === 'NpcCancel'),
    ).toEqual([])

    session.commandMapper.handlePointerUp(0)

    // Rapid second click within 200ms c2sDedupe window (e.g. at +180ms = 3180ms)
    session.commandMapper.handlePointerDown(npcScreen.x, npcScreen.y, 0, 3180)
    session.commandMapper.handlePointerUp(0)
    session.tick(3220)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.predictor.getSnapshot().moving).toBe(false)
  })

  it('4. fractional subtile predictor position rounds consistently and clicking outside active npcMenu.talking speech scroll dismisses speech without walking', () => {
    const { session, akaraId } = createSessionWithTownNpc(5000, 5000, 5003, 5000)
    const akaraUnit = session.world.getUnit('monster', akaraId)!

    // Fractional predictor position (4999.6, 5000) -> Math.round = 5000 -> dx = 3 (#10407 = 0 <= 2, in range)
    session.predictor.setPosition(4999.6, 5000)
    expect(
      session.commandMapper.isWithinInteractionMeleeRange(4999.6, 5000, akaraUnit),
    ).toBe(true)

    session.commandMapper.setHoveredUnit(akaraUnit)
    const npcScreen = session.camera.subtileToScreen(akaraUnit.x, akaraUnit.y)
    session.commandMapper.handlePointerDown(npcScreen.x, npcScreen.y, 0, 4000)
    session.commandMapper.handlePointerUp(0)
    session.tick(4040)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)

    // Enter active NPC speech scroll (talking = true)
    expect(session.hudManager.worldPanels.clickNpcMenuOption('talk_intro')).toBe(true)
    expect(session.hudManager.worldPanels.npcMenu?.talking).toBe(true)

    // Click on world space outside the speech scroll -> should dismiss speech scroll, NOT walk or NpcCancel
    session.commandMapper.setHoveredUnit(null)
    const sentBeforeDismiss = session.getSentCommands().length
    session.commandMapper.handlePointerDown(50, 50, 0, 4100)
    session.commandMapper.handlePointerUp(0)

    expect(session.hudManager.worldPanels.npcMenu).not.toBeNull()
    expect(session.hudManager.worldPanels.npcMenu?.talking).toBe(false)
    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.predictor.getSnapshot().moving).toBe(false)
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeDismiss)
        .filter((c) => c.type === 'MoveToUnit' || c.type === 'RunToLocation' || c.type === 'NpcCancel'),
    ).toEqual([])
  })
})
