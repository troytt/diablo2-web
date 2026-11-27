import { describe, expect, it, vi } from 'vitest'
import {
  clampJoystickAnchor,
  computeCompactD2rHudMetrics,
  computeDefaultJoystickAnchor,
  computeJoystickLockButtonMetrics,
  computeJoystickVector,
  computeJoystickWorldSubTileTarget,
  JOYSTICK_FIXED_HIT_PADDING,
  JOYSTICK_LOCK_FEEDBACK_MS,
  JOYSTICK_OUTER_RADIUS,
  scoreConeMonsterCandidate,
  selectBestConeTargets,
  TouchControlsHud,
  type ConeInteractableCandidate,
  type ConeMonsterCandidate,
} from '../../src/client/ui/touch-controls.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import {
  createDefaultClientSettings,
  parseClientSettingsJson,
  sanitizeClientSettings,
  VALID_VIEWPORT_RESOLUTIONS,
} from '../../src/client/settings/client-settings.ts'
import { getViewportProfile } from '../../src/client/view/viewport-profile.ts'

describe('Mobile Phase 2 (#1382): D2R Dynamic Twin-Stick Joystick & Cone Targeting', () => {
  it('computes joystick deadzone, walk zone, and outer auto-run zone accurately', () => {
    // 1. Inside deadzone (< 12% of 68px = 8.16px)
    const idle = computeJoystickVector(140, 460, 144, 462, 1, 68)
    expect(idle.active).toBe(true)
    expect(idle.locomotionMode).toBe('idle')
    expect(idle.magnitude).toBe(0)
    expect(idle.dx).toBe(0)
    expect(idle.dy).toBe(0)

    // 2. Mid-range walk zone (~40% deflection -> 27.2px right)
    const walk = computeJoystickVector(140, 460, 140 + 27.2, 460, 1, 68)
    expect(walk.locomotionMode).toBe('walk')
    expect(walk.magnitude).toBeCloseTo(0.4, 2)
    expect(walk.dx).toBeCloseTo(0.4, 2)
    expect(walk.dy).toBeCloseTo(0, 2)

    // 3. Outer auto-run zone (>= 65% deflection -> 80px up-right, clamped to 68px)
    const run = computeJoystickVector(140, 460, 220, 380, 1, 68)
    expect(run.locomotionMode).toBe('run')
    expect(run.magnitude).toBeCloseTo(1, 3)
    expect(Math.hypot(run.knobX - 140, run.knobY - 460)).toBeCloseTo(68, 2)
    expect(run.angleRad).toBeCloseTo(-Math.PI / 4, 2)
  })

  it('projects screen joystick vectors into isometric world subtile targets', () => {
    // Screen right (+1, 0) in 2:1 isometric maps to (+subX, -subY)
    const rightTarget = computeJoystickWorldSubTileTarget(100, 100, 1, 0, 10)
    expect(rightTarget.x).toBeGreaterThan(100)
    expect(rightTarget.y).toBeLessThan(100)

    // Screen down (0, +1) in 2:1 isometric maps to (+subX, +subY)
    const downTarget = computeJoystickWorldSubTileTarget(100, 100, 0, 1, 10)
    expect(downTarget.x).toBeGreaterThan(100)
    expect(downTarget.y).toBeGreaterThan(100)

    // Zero vector returns rounded player position
    expect(computeJoystickWorldSubTileTarget(100, 100, 0, 0, 10)).toEqual({ x: 100, y: 100 })
  })

  it('filters monsters by ±45° cone and prioritizes Boss/SuperUnique/Unique monsters', () => {
    const playerX = 400
    const playerY = 300
    const facingRight = 0 // 0 rad = directly right (+X)

    const normalFrontNear: ConeMonsterCandidate = {
      unitId: 101,
      name: '堕落罗格',
      screenX: 520,
      screenY: 305,
      hp: 80,
      maxHp: 100,
    }
    const superUniqueInCone: ConeMonsterCandidate = {
      unitId: 102,
      name: '冰冷乌鸦',
      screenX: 560,
      screenY: 330,
      hp: 240,
      maxHp: 300,
      isSuperUnique: true,
      isDemon: true,
      descriptors: ['冰冷强化', '特别快速'],
    }
    const behindMonster: ConeMonsterCandidate = {
      unitId: 103,
      name: '沉沦魔',
      screenX: 280,
      screenY: 300,
      hp: 50,
      maxHp: 50,
    }
    const deadMonster: ConeMonsterCandidate = {
      unitId: 104,
      name: '尸体',
      screenX: 430,
      screenY: 300,
      hp: 0,
      maxHp: 100,
      isDead: true,
    }

    expect(scoreConeMonsterCandidate(playerX, playerY, facingRight, behindMonster)).toBeNull()
    expect(scoreConeMonsterCandidate(playerX, playerY, facingRight, deadMonster)).toBeNull()

    const selection = selectBestConeTargets(
      playerX,
      playerY,
      facingRight,
      [normalFrontNear, superUniqueInCone, behindMonster, deadMonster],
      [],
    )
    expect(selection.lockedMonster).not.toBeNull()
    // SuperUnique (+0.35 tier bonus) beats slightly closer normal mob inside the cone
    expect(selection.lockedMonster?.candidate.unitId).toBe(102)
    expect(selection.lockedMonster?.candidate.name).toBe('冰冷乌鸦')
  })

  it('selects highest-priority foot-proximity interactable/loot for the [A 拾取] button', () => {
    const playerX = 400
    const playerY = 300
    const interactables: ConeInteractableCandidate[] = [
      { id: 1, kind: 'item', label: '轻微治疗药水', screenX: 420, screenY: 305, qualityRank: 1 },
      { id: 2, kind: 'item', label: '谐角之冠军帽 (军帽)', screenX: 432, screenY: 310, qualityRank: 6 },
      { id: 3, kind: 'item', label: '过远物品', screenX: 700, screenY: 500, qualityRank: 6 },
    ]

    const res = selectBestConeTargets(playerX, playerY, 0, [], interactables)
    expect(res.lockedInteractable?.id).toBe(2)
    expect(res.lockedInteractable?.label).toBe('谐角之冠军帽 (军帽)')
  })

  it('integrates TouchControlsHud with HudManager, interception hit-testing, and top monster bar fallback', () => {
    const canvas = {
      width: 800,
      height: 600,
      clientWidth: 800,
      clientHeight: 600,
      style: {},
      getContext: () => ({
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        drawImage: vi.fn(),
        setLineDash: vi.fn(),
        measureText: (t: string) => ({ width: t.length * 8 }),
      }),
    } as unknown as HTMLCanvasElement

    const hud = new HudManager(canvas)
    hud.touchControls.enabled = true

    // Left-bottom joystick zone is intercepted by HUD when touchControls.enabled = true
    expect(hud.isPointInterceptedByHud(120, 450)).toBe(true)
    // Center world area is not intercepted when joystick is idle
    expect(hud.isPointInterceptedByHud(400, 260)).toBe(false)

    // Activate floating joystick at (130, 440) and drag to (195, 390)
    expect(hud.touchControls.handlePointerDown(7, 130, 440, 800, 600, false)).toBe(true)
    expect(hud.touchControls.handlePointerMove(7, 195, 390)).toBe(true)
    expect(hud.touchControls.joystick.locomotionMode).toBe('run')

    hud.touchControls.updateTargets(
      400,
      280,
      [
        {
          unitId: 501,
          name: '尸体发火',
          screenX: 510,
          screenY: 210,
          hp: 450,
          maxHp: 500,
          isSuperUnique: true,
          isUndead: true,
        },
      ],
      [],
    )
    expect(hud.touchControls.lockedMonster?.candidate.name).toBe('尸体发火')

    const drawMonsterSpy = vi.spyOn(hud.worldPanels, 'drawMonsterTargetBar')
    hud.render(1000)
    expect(drawMonsterSpy).toHaveBeenCalled()
    const passedTarget = drawMonsterSpy.mock.calls[0]?.[1]
    expect(passedTarget?.name).toBe('尸体发火')
    expect(passedTarget?.hp).toBe(450)
    expect(passedTarget?.maxHp).toBe(500)
    expect(passedTarget?.rank).toBe('superunique')

    expect(hud.touchControls.handlePointerUp(7)).toBe(true)
    expect(hud.touchControls.joystick.active).toBe(false)
  })

  it('supports fixed left-joystick mode with persistent current-position anchor, bounded 92px hit zone, and visual lock indicators', () => {
    const tc = new TouchControlsHud()
    tc.enabled = true
    tc.hudLayoutMode = 'compact-d2r'
    tc.syncViewport(1068, 600)

    // Default mode is floating
    expect(tc.joystickMode).toBe('floating')
    expect(createDefaultClientSettings().mobileJoystickMode).toBe('floating')

    // Move floating joystick to custom spot (180, 420), then release
    expect(tc.handlePointerDown(10, 180, 420, 1068, 600, false)).toBe(true)
    expect(tc.joystick.originX).toBe(180)
    expect(tc.joystick.originY).toBe(420)
    expect(tc.handlePointerUp(10)).toBe(true)

    // Tap on-canvas padlock medallion to lock at the current custom position
    const lockBtn = computeJoystickLockButtonMetrics(180, 420, 1068, 600)
    expect(tc.hitTestLockButton(lockBtn.cx, lockBtn.cy, 1068, 600, false)).toBe(true)
    const lockEvents: Array<{ mode: string; anchorRx?: number | undefined; anchorRy?: number | undefined }> = []
    tc.onJoystickLockChange = (ev) => lockEvents.push(ev)

    const lockedEv = tc.toggleJoystickLock(1068, 600, 5000)
    expect(lockedEv.mode).toBe('fixed')
    expect(tc.joystickMode).toBe('fixed')
    expect(tc.joystick.originX).toBe(180)
    expect(tc.joystick.originY).toBe(420)
    expect(tc.isLockFeedbackActive(5500)).toBe(true)
    expect(tc.isLockFeedbackActive(5000 + JOYSTICK_LOCK_FEEDBACK_MS + 1)).toBe(false)
    expect(lockEvents).toHaveLength(1)
    expect(lockEvents[0]?.anchorRx).toBeCloseTo(180 / 1068, 3)
    expect(lockEvents[0]?.anchorRy).toBeCloseTo(420 / 600, 3)

    // Inside bounded 92px hit radius: triggers joystick WITHOUT moving origin
    const offCenterX = 180 + 55
    const offCenterY = 420 - 15
    expect(tc.isInLeftJoystickZone(offCenterX, offCenterY, 1068, 600, false)).toBe(true)
    expect(tc.handlePointerDown(11, offCenterX, offCenterY, 1068, 600, false)).toBe(true)
    expect(tc.joystick.originX).toBe(180)
    expect(tc.joystick.originY).toBe(420)
    expect(tc.joystick.locomotionMode).toBe('run')

    // While actively dragging, lock medallion hit-test is suppressed so upper-left drags never unlock
    expect(tc.hitTestLockButton(lockBtn.cx, lockBtn.cy, 1068, 600, false)).toBe(false)
    expect(tc.handlePointerUp(11)).toBe(true)
    expect(tc.joystick.originX).toBe(180)
    expect(tc.joystick.originY).toBe(420)

    // Outside bounded 92px hit radius inside old bottom-left 35% zone: returns false so world taps work!
    const outsideX = 180 + JOYSTICK_OUTER_RADIUS + JOYSTICK_FIXED_HIT_PADDING + 24 // 296 (< 0.35 * 1068 = 373)
    const outsideY = 260 // (>= 0.35 * 600 = 210, outside compact bar)
    expect(tc.isInLeftJoystickZone(outsideX, outsideY, 1068, 600, false)).toBe(false)
    expect(tc.handlePointerDown(12, outsideX, outsideY, 1068, 600, false)).toBe(false)

    // Draw visual indicators: locked badge caption + transient toast pill, yielding to RUN when sprinting
    const drawnTexts: string[] = []
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const mockFont = {
      drawText: (_ctx: unknown, text: string) => drawnTexts.push(text),
    } as never

    tc.drawJoystick(mockCtx, mockFont, 'CHI', 1068, 600, 5200)
    expect(drawnTexts).toContain('已固定')
    expect(drawnTexts).toContain('摇杆已固定')

    drawnTexts.length = 0
    tc.drawJoystick(mockCtx, mockFont, 'ENG', 1068, 600, 5200)
    expect(drawnTexts).toContain('LOCKED')
    expect(drawnTexts).toContain('JOYSTICK LOCKED')

    // Viewport switch re-resolves & clamps anchor cleanly without overlapping compact HUD
    tc.syncViewport(800, 600)
    const m800 = computeCompactD2rHudMetrics(800, 600)
    expect(tc.joystick.originY + JOYSTICK_OUTER_RADIUS).toBeLessThanOrEqual(m800.barY)

    // Resetting transient state in fixed mode preserves fixed anchor
    tc.handlePointerDown(13, tc.joystick.originX + 20, tc.joystick.originY, 800, 600, false)
    const pinnedX = tc.joystick.originX
    const pinnedY = tc.joystick.originY
    tc.resetTransientState()
    expect(tc.joystick.active).toBe(false)
    expect(tc.joystick.originX).toBe(pinnedX)
    expect(tc.joystick.originY).toBe(pinnedY)
  })

  it('computes non-overlapping default fixed anchors across all 7 resolutions and sanitizes settings', () => {
    for (const resId of VALID_VIEWPORT_RESOLUTIONS) {
      const vp = getViewportProfile(resId)
      const anchor = computeDefaultJoystickAnchor(vp.width, vp.height, true, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      })
      const m = computeCompactD2rHudMetrics(vp.width, vp.height)
      // Must stay inside screen bounds
      expect(anchor.x - JOYSTICK_OUTER_RADIUS).toBeGreaterThanOrEqual(0)
      expect(anchor.y - JOYSTICK_OUTER_RADIUS).toBeGreaterThanOrEqual(0)
      expect(anchor.y + JOYSTICK_OUTER_RADIUS).toBeLessThanOrEqual(vp.height)
      // Must not overlap the compact bottom bar
      const overlapsBar =
        anchor.x + JOYSTICK_OUTER_RADIUS > m.barX && anchor.y + JOYSTICK_OUTER_RADIUS > m.barY
      expect(overlapsBar).toBe(false)
      // Clamped anchor is idempotent
      expect(clampJoystickAnchor(anchor.x, anchor.y, vp.width, vp.height, true, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      })).toEqual(anchor)
    }

    const sanitized = sanitizeClientSettings({
      mobileJoystickMode: 'fixed',
      mobileJoystickAnchorRx: 0.16854,
      mobileJoystickAnchorRy: 0.71234,
    })
    expect(sanitized.mobileJoystickMode).toBe('fixed')
    expect(sanitized.mobileJoystickAnchorRx).toBe(0.1685)
    expect(sanitized.mobileJoystickAnchorRy).toBe(0.7123)

    const parsed = parseClientSettingsJson(JSON.stringify({ mobileJoystickMode: 'bogus', mobileJoystickAnchorRx: NaN }))
    expect(parsed.mobileJoystickMode).toBe('floating')
    expect(parsed.mobileJoystickAnchorRx).toBeUndefined()
  })
})
