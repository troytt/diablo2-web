/**
 * Issue — pressing C (char panel) / B,T (skill / inventory) must pan the camera
 * so the player stays centered in the visible half, like 1.13c.
 *
 * Two defects locked here:
 * 1. The OnlineSession scene state never reported `leftPanelOpen`/`rightPanelOpen`,
 *    so `snapshot.panelShiftX` was permanently 0 (no pan at all).
 * 2. `computePanelCameraShift` had inverted signs and a fixed 160px magnitude
 *    (the 640-wide value): left panel must pan the camera LEFT (player centered
 *    in the right half), right panel RIGHT; magnitude = viewportWidth / 4.
 */
import { describe, expect, it } from 'vitest'
import { CommandMapper, ViewportCamera } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import {
  computePanelCameraShift,
  panelDockWidth,
  VIEWPORT_640x480,
  VIEWPORT_800x600,
  VIEWPORT_1024x768,
  VIEWPORT_1068x600,
  VIEWPORT_1280x720,
} from '../src/client/view/viewport-profile.ts'
import { ClientWorldSceneSource } from '../src/client/view/scene-source.ts'
import type { ClientSceneWorldAdapter } from '../src/client/view/scene-source.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ClientCommand } from '../src/netproto/index.ts'

function adapterWith(panels: { leftPanelOpen?: boolean; rightPanelOpen?: boolean }): ClientSceneWorldAdapter {
  return {
    tick: 1,
    playerSubX: 500,
    playerSubY: 500,
    units: [],
    levelView: null,
    neighbourLevelViews: [],
    tileAtlas: null,
    ambient: null,
    ...panels,
  } as unknown as ClientSceneWorldAdapter
}

describe('[panel camera shift] 1.13c half-screen panel panning', () => {
  it('1. shifts by panelDockWidth/2 with authentic signs', () => {
    // Left panel open: visible area is the right one → camera moves left (negative).
    expect(computePanelCameraShift(true, false, 400)).toBe(-200)
    // Right panel (inventory/skills): player centered in left visible area → positive.
    expect(computePanelCameraShift(false, true, 400)).toBe(200)
    // Both open or none: centered.
    expect(computePanelCameraShift(true, true, 400)).toBe(0)
    expect(computePanelCameraShift(false, false, 400)).toBe(0)
    // Panels are fixed-size art, NOT half the screen: 320 wide only at 640x480.
    expect(computePanelCameraShift(true, false, 320)).toBe(-160)
    // Extended viewports keep 400-wide docks — shift stays 200 at 1024/1280+,
    // never width/4 (256/320 would misplace the player; user-reported 1280x720).
    expect(computePanelCameraShift(false, true, 400)).toBe(200)
  })

  it('2. panelDockWidth: 320 at 640x480, 400 everywhere else incl. extended', () => {
    expect(panelDockWidth(VIEWPORT_800x600)).toBe(400)
    expect(panelDockWidth(VIEWPORT_1024x768)).toBe(400)
    expect(panelDockWidth(VIEWPORT_1280x720)).toBe(400)
  })

  it('2. scene camera pans when the world adapter reports panels open', () => {
    const sourceNoPanel = new ClientWorldSceneSource(() => adapterWith({}), VIEWPORT_800x600)
    const sourceLeft = new ClientWorldSceneSource(
      () => adapterWith({ leftPanelOpen: true }),
      VIEWPORT_800x600,
    )
    const sourceRight = new ClientWorldSceneSource(
      () => adapterWith({ rightPanelOpen: true }),
      VIEWPORT_1024x768,
    )
    const base = sourceNoPanel.getCameraTopLeft().x
    expect(sourceLeft.getCameraTopLeft().x).toBe(base - 200)
    expect(sourceRight.getCameraTopLeft(VIEWPORT_1024x768).x).toBe(
      sourceNoPanel.getCameraTopLeft(VIEWPORT_1024x768).x + 200,
    )
  })

  it('3. frame snapshot carries the panel shift so the renderer pans', () => {
    const source = new ClientWorldSceneSource(
      () => adapterWith({ rightPanelOpen: true }),
      VIEWPORT_800x600,
    )
    const snap = source.buildFrameSnapshot()
    expect(snap.panelShiftX).toBe(200)
  })

  it('4. ViewportCamera subtileToScreen and screenToSubtile round-trip with panelShiftX across viewports (Issue #1380)', () => {
    const cam = new ViewportCamera(VIEWPORT_800x600)
    cam.snapTo(5000, 5000)

    const unshifted = cam.subtileToScreen(5006, 5000)
    expect(unshifted.x).toBe(400 + 6 * 16)

    // Left panel open (panelShiftX = -200): world shifts +200px right on screen
    cam.setPanelShiftX(-200)
    const leftPanelPos = cam.subtileToScreen(5006, 5000)
    expect(leftPanelPos.x).toBe(unshifted.x + 200)
    expect(leftPanelPos.y).toBe(unshifted.y)
    const roundTripLeft = cam.screenToSubtile(leftPanelPos.x, leftPanelPos.y)
    expect(roundTripLeft.x).toBe(5006)
    expect(roundTripLeft.y).toBe(5000)

    // Right panel open (panelShiftX = +200): world shifts -200px left on screen
    cam.setPanelShiftX(200)
    const rightPanelPos = cam.subtileToScreen(5006, 5000)
    expect(rightPanelPos.x).toBe(unshifted.x - 200)
    expect(rightPanelPos.y).toBe(unshifted.y)
    const roundTripRight = cam.screenToSubtile(rightPanelPos.x, rightPanelPos.y)
    expect(roundTripRight.x).toBe(5006)
    expect(roundTripRight.y).toBe(5000)
  })

  it('5. CommandMapper hits Stash at its shifted visual coordinates (and NOT at unshifted empty ground) when Character, Quest, or Inventory panel is open (Issue #1380)', () => {
    for (const profile of [VIEWPORT_800x600, VIEWPORT_1068x600, VIEWPORT_640x480]) {
      const world = new ClientWorld()
      const hudManager = new HudManager()
      hudManager.setViewportProfile(profile)
      const sentCommands: ClientCommand[] = []
      const hudModel = new HudModel({
        world,
        hudManager,
        onCommand: (cmd) => sentCommands.push(cmd),
      })
      const predictor = new LocalMovementPredictor()
      predictor.setPosition(5000, 5000)
      const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0 })
      const camera = new ViewportCamera(profile)

      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        classId: 1,
        name: 'Hero',
        x: 5000,
        y: 5000,
      })

      // Place Stash (classId = 267) at (5003, 5003) -> straight down on screen (dx = 0, dy = +48)
      const stashId = 2670
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 2,
          id: stashId,
          classId: 267,
          name: 'Bank',
          x: 5003,
          y: 5003,
          mode: 0,
        },
      })

      const mapper = new CommandMapper({
        world,
        hudManager,
        hudModel,
        predictor,
        rateLimiter,
        camera,
        sendCommand: (cmd) => sentCommands.push(cmd),
      })

      camera.snapTo(5000, 5000)
      camera.setPanelShiftX(0)
      const baseScreenPos = camera.subtileToScreen(5003, 5003)
      // Object visual center has -20px vertical offset in findUnitAtScreenPoint
      const hoverY = baseScreenPos.y - 20
      const dockShift = panelDockWidth(profile) / 2

      // (a) No panels open: Stash is at baseScreenPos.x
      mapper.handlePointerMove({ clientX: baseScreenPos.x, clientY: hoverY }, 100)
      expect(mapper.currentHoveredUnit?.id).toBe(stashId)

      // (b) Left panel open (Character 'char' or Quest 'quest'):
      // panelShiftX = -dockShift -> Stash renders at baseScreenPos.x + dockShift
      for (const leftPanel of ['char', 'quest'] as const) {
        hudManager.leftPanel = leftPanel
        hudManager.rightPanel = 'none'

        // Hovering directly over the visually shifted Stash MUST show Stash hover
        mapper.handlePointerMove({ clientX: baseScreenPos.x + dockShift, clientY: hoverY }, 200)
        expect(mapper.currentHoveredUnit?.id).toBe(stashId)

        // Hovering over adjacent empty ground 120px to the left MUST NOT show Stash hover
        mapper.handlePointerMove({ clientX: baseScreenPos.x + dockShift - 120, clientY: hoverY }, 210)
        expect(mapper.currentHoveredUnit?.id ?? null).toBeNull()
      }

      // (c) Right panel open (Inventory 'inv' or Skills 'skill'):
      // panelShiftX = +dockShift -> Stash renders at baseScreenPos.x - dockShift
      for (const rightPanel of ['inv', 'skill'] as const) {
        hudManager.leftPanel = 'none'
        hudManager.rightPanel = rightPanel

        // Hovering directly over the visually shifted Stash MUST show Stash hover
        mapper.handlePointerMove({ clientX: baseScreenPos.x - dockShift, clientY: hoverY }, 300)
        expect(mapper.currentHoveredUnit?.id).toBe(stashId)

        // Hovering over adjacent empty ground 120px to the left MUST NOT show Stash hover
        mapper.handlePointerMove({ clientX: baseScreenPos.x - dockShift - 120, clientY: hoverY }, 310)
        expect(mapper.currentHoveredUnit?.id ?? null).toBeNull()
      }

      // (d) Both panels open: panelShiftX = 0 -> camera returns to center
      hudManager.leftPanel = 'char'
      hudManager.rightPanel = 'inv'
      mapper.handlePointerMove({ clientX: baseScreenPos.x, clientY: hoverY }, 400)
      expect(camera.panelShiftX).toBe(0)
    }
  })

  it('6. toggling a panel via keyboard hotkey while cursor is stationary immediately refreshes hover target (Issue #1380)', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    hudManager.setViewportProfile(VIEWPORT_800x600)
    const hudModel = new HudModel({
      world,
      hudManager,
      onCommand: () => {},
    })
    const predictor = new LocalMovementPredictor()
    predictor.setPosition(5000, 5000)
    const camera = new ViewportCamera(VIEWPORT_800x600)

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Hero',
      x: 5000,
      y: 5000,
    })
    const stashId = 2670
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: stashId,
        classId: 267,
        name: 'Bank',
        x: 5003,
        y: 5003,
        mode: 0,
      },
    })

    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      camera,
    })

    camera.snapTo(5000, 5000)
    camera.setPanelShiftX(0)
    const baseScreenPos = camera.subtileToScreen(5003, 5003)
    const hoverY = baseScreenPos.y - 20

    // Cursor rests at x = baseScreenPos.x + 200 (empty ground while no panels are open)
    mapper.handlePointerMove({ clientX: baseScreenPos.x + 200, clientY: hoverY }, 100)
    expect(mapper.currentHoveredUnit).toBeNull()

    // Press 'C' to open Character panel -> camera shifts so Stash moves under the stationary cursor
    mapper.handleKeyDown({ key: 'c', code: 'KeyC' }, 200)
    expect(hudManager.leftPanel).toBe('char')
    expect(mapper.currentHoveredUnit?.id).toBe(stashId)

    // Press 'C' again to close Character panel -> Stash moves back to center, stationary cursor is over empty ground
    mapper.handleKeyDown({ key: 'c', code: 'KeyC' }, 300)
    expect(hudManager.leftPanel).toBe('none')
    expect(mapper.currentHoveredUnit).toBeNull()
  })
})
