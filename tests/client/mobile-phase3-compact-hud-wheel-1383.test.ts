import { describe, expect, it, vi } from 'vitest'
import {
  COMPACT_HUD_WIDTH,
  SKILL_WHEEL_MAIN_RADIUS,
  computeCompactD2rHudMetrics,
  detectMobileTouchEnvironment,
  hitTestCompactD2rHud,
  TouchControlsHud,
} from '../../src/client/ui/touch-controls.ts'
import { handleCompactD2rHudClick } from '../../src/client/ui/hud-input-router.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import {
  parseClientSettingsJson,
  sanitizeClientSettings,
} from '../../src/client/settings/client-settings.ts'

function createMockHudCanvas(width = 800, height = 600): HTMLCanvasElement {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
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
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      measureText: (t: string) => ({ width: t.length * 8 }),
    }),
  } as unknown as HTMLCanvasElement
}

describe('Mobile Phase 3 (#1383): D2R 524px Compact Center Bar & 6x2 Skill Wheel', () => {
  it('computes 524px D2R Demon/Angel Compact Center Bar metrics and frees outer ground margins', () => {
    const m800 = computeCompactD2rHudMetrics(800, 600)
    expect(m800.barWidth).toBe(COMPACT_HUD_WIDTH)
    expect(m800.barWidth).toBe(524)
    // Shifted left on 800x600 (barX = 28 -> barRight = 552) so right-side 6x2 skill wheel never overlaps the mana globe
    expect(m800.barX).toBe(28)
    expect(m800.barY).toBe(496)
    expect(m800.beltSlots).toHaveLength(4)
    expect(m800.beltSlots[0]?.size).toBe(48)
    expect(m800.topUtilityBar.buttons).toHaveLength(6)
    expect(m800.wheel.arcSlots).toHaveLength(5)
    expect(m800.wheel.mainR).toBe(SKILL_WHEEL_MAIN_RADIUS)

    const m1280 = computeCompactD2rHudMetrics(1280, 600)
    expect(m1280.barX).toBe(378) // (1280 - 524) / 2 = 378px free on each side
  })

  it('hit-tests top-right utility bar, L2 bank switcher, 6x2 skill wheel, and 4x4 popbelt drawer', () => {
    const m = computeCompactD2rHudMetrics(1280, 600)

    // 1. Top-Right Utility Bar button (Inventory)
    const invBtn = m.topUtilityBar.buttons.find((b) => b.action === 'inv')!
    const hitInv = hitTestCompactD2rHud(invBtn.x + 10, invBtn.y + 10, 1280, 600, false, 0)
    expect(hitInv).toEqual({ kind: 'utilityAction', action: 'inv' })

    // 2. L2 Bank Switcher
    const hitL2 = hitTestCompactD2rHud(
      m.l2PreviewBar.l2Btn.x + 10,
      m.l2PreviewBar.l2Btn.y + 10,
      1280,
      600,
      false,
      0,
    )
    expect(hitL2).toEqual({ kind: 'l2BankSwitch' })

    // 3. Primary Skill Slot in Bank 0 (F6 -> index 5) vs Bank 1 (F12 -> index 11)
    expect(hitTestCompactD2rHud(m.wheel.cx, m.wheel.cy, 1280, 600, false, 0)).toEqual({
      kind: 'primarySkill',
      hotkeyIndex: 5,
    })
    expect(hitTestCompactD2rHud(m.wheel.cx, m.wheel.cy, 1280, 600, false, 1)).toEqual({
      kind: 'primarySkill',
      hotkeyIndex: 11,
    })

    // 4. Satellite Arc Slot 0 in Bank 0 (F1 -> index 0) vs Bank 1 (F7 -> index 6)
    const arc0 = m.wheel.arcSlots[0]!
    expect(hitTestCompactD2rHud(arc0.cx, arc0.cy, 1280, 600, false, 0)).toEqual({
      kind: 'wheelSkill',
      arcIndex: 0,
      hotkeyIndex: 0,
    })
    expect(hitTestCompactD2rHud(arc0.cx, arc0.cy, 1280, 600, false, 1)).toEqual({
      kind: 'wheelSkill',
      arcIndex: 0,
      hotkeyIndex: 6,
    })

    // 5. Popbelt 4x4 Drawer when beltExpanded = true (row 3 is top row of expanded popbelt)
    const slotSize = m.beltSlots[0]!.size
    const row3Y = m.beltSlots[0]!.y - 3 * (slotSize + 4) + 10
    const hitPopSlot = hitTestCompactD2rHud(
      m.beltSlots[0]!.x + 10,
      row3Y,
      1280,
      600,
      true,
      0,
    )
    expect(hitPopSlot).toEqual({ kind: 'popbeltCell', col: 0, row: 3 })
  })

  it('supports hold-to-drag vector aiming for directional skills (e.g. Teleport / Blizzard)', () => {
    const tc = new TouchControlsHud()
    tc.beginVectorAim(11, 4, 54, 1140, 490, 640, 300)
    expect(tc.vectorAim?.active).toBe(true)
    expect(tc.vectorAim?.skillId).toBe(54)

    // Drag 64px to the right (+X) -> targetScreenX shifts by +240px from playerScreenX (640 -> 880)
    expect(tc.updateVectorAim(11, 1140 + 64, 490, 640, 300, 64, 240)).toBe(true)
    expect(tc.vectorAim?.targetScreenX).toBe(880)
    expect(tc.vectorAim?.targetScreenY).toBe(300)

    const finished = tc.endVectorAim(11)
    expect(finished?.targetScreenX).toBe(880)
    expect(tc.vectorAim).toBeNull()
  })

  it('routes clicks and renders D2R Compact HUD & 6x2 Skill Wheel through HudManager', () => {
    const hud = new HudManager(createMockHudCanvas(800, 600))
    hud.touchControls.enabled = true
    hud.touchControls.hudLayoutMode = 'compact-d2r'
    hud.touchControls.wheelSlots = Array.from({ length: 12 }, (_, idx) => ({
      hotkeyIndex: idx,
      keyLabel: `F${idx + 1}`,
      skillId: 36 + idx,
      name: `Skill_${idx + 1}`,
      hand: 'right' as const,
    }))

    expect(hud.touchControls.compactHudActive).toBe(true)
    const m = computeCompactD2rHudMetrics(800, 600)

    // Clicking L2 switches activeSkillBank from 0 to 1
    handleCompactD2rHudClick(
      hud,
      m.l2PreviewBar.l2Btn.x + 8,
      m.l2PreviewBar.l2Btn.y + 8,
    )
    expect(hud.touchControls.activeSkillBank).toBe(1)

    // Clicking primary wheel slot in Bank 1 activates F12 (index 11 -> skillId 47)
    handleCompactD2rHudClick(hud, m.wheel.cx, m.wheel.cy)
    expect(hud.hotkeys.rightSkillId).toBe(47)

    // Clicking top-right Inventory utility button toggles rightPanel = 'inv'
    const invBtn = m.topUtilityBar.buttons.find((b) => b.action === 'inv')!
    handleCompactD2rHudClick(hud, invBtn.x + 8, invBtn.y + 8)
    expect(hud.rightPanel).toBe('inv')

    // Render HUD in compact-d2r mode without errors
    const drawCompactSpy = vi.spyOn(hud.touchControls, 'drawCompactD2rHudAndWheel')
    hud.render(2000)
    expect(drawCompactSpy).toHaveBeenCalled()
  })

  it('sanitizes and parses hudLayoutMode and skillWheelBankMode in ClientSettings', () => {
    const sanitized = sanitizeClientSettings({
      hudLayoutMode: 'compact-d2r',
      skillWheelBankMode: 'hold',
    })
    expect(sanitized.hudLayoutMode).toBe('compact-d2r')
    expect(sanitized.skillWheelBankMode).toBe('hold')

    const parsed = parseClientSettingsJson(
      JSON.stringify({
        hudLayoutMode: 'classic',
        skillWheelBankMode: 'toggle',
      }),
    )
    expect(parsed.hudLayoutMode).toBe('classic')
    expect(parsed.skillWheelBankMode).toBe('toggle')
  })

  it('auto-detects Chrome DevTools mobile emulation via syncFromEnvironment and dynamically resolves hotkeys on the 6x2 wheel', () => {
    const mockMobileWin = {
      innerWidth: 852,
      innerHeight: 393,
      matchMedia: (q: string) => ({
        matches: q === '(pointer: coarse)' || q === '(hover: none)',
      }),
    } as unknown as Window

    expect(detectMobileTouchEnvironment(mockMobileWin)).toBe(true)

    const tc = new TouchControlsHud()
    expect(tc.enabled).toBe(false)
    expect(tc.syncFromEnvironment(mockMobileWin)).toBe(true)
    expect(tc.enabled).toBe(true)
    expect(tc.compactHudActive).toBe(true)

    // Manual override is respected when environment hasn't changed
    tc.enabled = false
    expect(tc.syncFromEnvironment(mockMobileWin)).toBe(false)
    expect(tc.enabled).toBe(false)

    // Dynamic skill wheel slot resolution from HudManager.hotkeys when wheelSlots is empty:
    // Page 1 (0..5) = Left-Hand shortcuts (5 = leftSkillId), Page 2 (6..11) = Right-Hand shortcuts (11 = rightSkillId)
    const hud = new HudManager(createMockHudCanvas(1068, 600))
    hud.resize(1068, 600)
    hud.touchControls.enabled = true
    hud.hotkeys.leftSkillId = 47 // Fire Ball on Left Hand
    hud.hotkeys.rightSkillId = 54 // Teleport on Right Hand
    hud.hotkeys.setAvailableSkills([
      { skillId: 0, name: 'Attack', nameZh: '普通攻击', level: 1, manaCost: 0, leftUsable: true, rightUsable: false },
      { skillId: 47, name: 'Fire Ball', nameZh: '火球', level: 1, manaCost: 5, leftUsable: true, rightUsable: true },
      { skillId: 54, name: 'Teleport', nameZh: '传送', level: 1, manaCost: 24, leftUsable: false, rightUsable: true },
      { skillId: 59, name: 'Blizzard', nameZh: '暴风雪', level: 1, manaCost: 23, leftUsable: false, rightUsable: true },
    ])
    hud.hotkeys.bindHotkey('F1', 'left', 0)
    hud.hotkeys.bindHotkey('F7', 'right', 59)

    // Page 1 satellite F1 (index 0) resolves to bound Left-Hand Attack (#0)
    expect(hud.touchControls.resolveWheelSlot(0, hud.hotkeys).skillId).toBe(0)
    expect(hud.touchControls.resolveWheelSlot(0, hud.hotkeys).hand).toBe('left')
    // Page 1 Main Button F6 (index 5) resolves to active leftSkillId (#47 Fire Ball)
    expect(hud.touchControls.resolveWheelSlot(5, hud.hotkeys).skillId).toBe(47)
    expect(hud.touchControls.resolveWheelSlot(5, hud.hotkeys).hand).toBe('left')

    // Page 2 satellite F7 (index 6) resolves to bound Right-Hand Blizzard (#59)
    expect(hud.touchControls.resolveWheelSlot(6, hud.hotkeys).skillId).toBe(59)
    expect(hud.touchControls.resolveWheelSlot(6, hud.hotkeys).hand).toBe('right')
    // Page 2 Main Button F12 (index 11) resolves to active rightSkillId (#54 Teleport)
    expect(hud.touchControls.resolveWheelSlot(11, hud.hotkeys).skillId).toBe(54)
    expect(hud.touchControls.resolveWheelSlot(11, hud.hotkeys).hand).toBe('right')

    // Clicking satellite F7 on Page 2 selects Blizzard (#59) as rightSkillId
    hud.touchControls.activeSkillBank = 1
    const m = computeCompactD2rHudMetrics(1068, 600)
    const arc0 = m.wheel.arcSlots[0]!
    handleCompactD2rHudClick(hud, arc0.cx, arc0.cy)
    expect(hud.hotkeys.rightSkillId).toBe(59)
  })

  it('Issue #1491: hudLayoutMode = classic forces touch HUD off even on mobile/touch environments and resets transient touch state', () => {
    const mockMobileWin = {
      innerWidth: 852,
      innerHeight: 393,
      matchMedia: (q: string) => ({
        matches: q === '(pointer: coarse)' || q === '(hover: none)',
      }),
    } as unknown as Window
    const mockDesktopWin = {
      innerWidth: 1440,
      innerHeight: 900,
      matchMedia: () => ({ matches: false }),
    } as unknown as Window

    const hud = new HudManager(createMockHudCanvas(800, 600))
    const tc = hud.touchControls

    // 1. Auto mode on mobile window enables touch HUD
    tc.applyHudLayoutMode('auto', mockMobileWin)
    expect(tc.enabled).toBe(true)
    expect(tc.compactHudActive).toBe(true)

    // Populate active transient touch states (joystick, vector aim, locked monster, selected item, skill bank)
    tc.handlePointerDown(5, 130, 440, 800, 600, false)
    tc.handlePointerMove(5, 180, 400)
    tc.beginVectorAim(9, 2, 54, 680, 480, 400, 300)
    tc.activeSkillBank = 1
    tc.lockedMonster = {
      candidate: { unitId: 77, name: '暗黑破坏神', screenX: 420, screenY: 260, hp: 80, maxHp: 100 },
      score: 100,
      distancePx: 60,
      angleDiffRad: 0.1,
    }
    expect(tc.joystick.active).toBe(true)
    expect(tc.vectorAim).not.toBeNull()
    expect(tc.activeSkillBank).toBe(1)
    expect(tc.lockedMonster).not.toBeNull()

    // 2. Switching to 'classic' forces touch HUD off even when syncFromEnvironment sees a mobile window,
    //    and immediately resets all transient touch state.
    tc.applyHudLayoutMode('classic', mockMobileWin)
    expect(tc.hudLayoutMode).toBe('classic')
    expect(tc.enabled).toBe(false)
    expect(tc.compactHudActive).toBe(false)
    expect(tc.syncFromEnvironment(mockMobileWin)).toBe(false)
    expect(tc.joystick.active).toBe(false)
    expect(tc.vectorAim).toBeNull()
    expect(tc.lockedMonster).toBeNull()
    expect(tc.activeSkillBank).toBe(0)

    // Classic bottom control bar hit-testing is restored (left-bottom joystick area outside y>=553 is not intercepted)
    expect(hud.isPointInterceptedByHud(120, 420)).toBe(false)
    expect(hud.isPointInterceptedByHud(400, 580)).toBe(true)

    // 3. Switching to 'compact-d2r' forces touch HUD on even on a desktop window
    tc.applyHudLayoutMode('compact-d2r', mockDesktopWin)
    expect(tc.hudLayoutMode).toBe('compact-d2r')
    expect(tc.enabled).toBe(true)
    expect(tc.compactHudActive).toBe(true)
    expect(tc.syncFromEnvironment(mockDesktopWin)).toBe(true)

    // 4. Manual override (`tc.enabled = false`) is preserved across environment/window changes in 'auto' mode
    tc.applyHudLayoutMode('auto', mockMobileWin)
    expect(tc.enabled).toBe(true)
    tc.enabled = false
    expect(tc.syncFromEnvironment(mockDesktopWin)).toBe(false)
    expect(tc.syncFromEnvironment(mockMobileWin)).toBe(false)
  })
})
