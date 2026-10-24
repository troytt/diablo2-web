import { describe, expect, it, vi } from 'vitest'
import {
  computeJoystickVector,
  computeJoystickWorldSubTileTarget,
  scoreConeMonsterCandidate,
  selectBestConeTargets,
  TouchControlsHud,
  type ConeInteractableCandidate,
  type ConeMonsterCandidate,
} from '../../src/client/ui/touch-controls.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

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
})
