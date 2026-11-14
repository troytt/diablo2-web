import { describe, expect, it, vi } from 'vitest'
import {
  computeCompactD2rHudMetrics,
  detectMobileTouchEnvironment,
  hitTestCompactD2rHud,
  TouchControlsHud,
} from '../../src/client/ui/touch-controls.ts'
import {
  buildCompactHudLayoutOptions,
  computeSelectedItemActionBar,
  executeTouchContextAction,
  handleCompactD2rHudClick,
  isPointInterceptedByHud,
  resolveTouchHudContext,
} from '../../src/client/ui/hud-input-router.ts'
import { isTouchCursorHidden } from '../../src/client/ui/hud-world-overlays.ts'
import { HudManager, type HudCommandSink } from '../../src/client/ui/hud-manager.ts'
import {
  CommandMapper,
  TOUCH_JOYSTICK_REPEAT_MS,
  TOUCH_POINTER_ID_OFFSET,
  TOUCH_SATELLITE_LONG_PRESS_MS,
} from '../../src/client/input/command-mapper.ts'
import type { UiInventoryItem } from '../../src/client/ui/inventory.ts'
import { DEFAULT_SKILL_WHEEL_BANK_MODE } from '../../src/client/settings/client-settings.ts'

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

function helm(id: string): UiInventoryItem {
  return {
    id,
    code: 'uap',
    name: 'Shako',
    nameZh: '军帽',
    baseNameZh: '军帽',
    invFile: 'invcap',
    quality: 'unique',
    identified: true,
    invWidth: 2,
    invHeight: 2,
    allowedSlots: ['helm'],
    stats: [{ text: '+2 To All Skills' }],
  }
}

function makeTouchHud(width = 800, height = 600): HudManager {
  const hud = new HudManager(createMockHudCanvas(width, height))
  if (width !== 800) hud.resize(width, height)
  hud.touchControls.enabled = true
  hud.touchControls.hudLayoutMode = 'compact-d2r'
  return hud
}

function makeMapper(hud: HudManager, sent: unknown[]): CommandMapper {
  const world = {
    self: { x: 5000, y: 5000, leftSkill: 0, rightSkill: 0, maxStamina: 0, stamina: 0 },
    areaId: 1,
    listUnits: () => [],
    getUnit: () => undefined,
    getRevealedAreaIds: () => [],
    containers: { cursor: null },
    npcInteraction: {},
    pendingMeleeAttack: null,
    noteOutgoingCommand: () => {},
  }
  return new CommandMapper({
    world: world as never,
    hudManager: hud,
    sendCommand: (cmd) => sent.push(cmd),
  })
}

describe('#1966 multi-touch routing & joystick hold loop', () => {
  it('does not treat a short landscape desktop window as a touch device', () => {
    const desktop = {
      innerWidth: 1280,
      innerHeight: 500,
      navigator: { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
      matchMedia: () => ({ matches: false }),
    } as unknown as Window
    expect(detectMobileTouchEnvironment(desktop)).toBe(false)
  })

  it('routes a joystick finger and an L2 finger independently and keeps moving while the stick is held', () => {
    const hud = makeTouchHud()
    const sent: unknown[] = []
    const mapper = makeMapper(hud, sent)
    const m = computeCompactD2rHudMetrics(800, 600)

    expect(mapper.handleTouchStart(1, 120, 450, 1000)).toBe('joystick')
    mapper.handleTouchMove(1, 180, 450, 1010)
    expect(hud.touchControls.joystick.active).toBe(true)
    expect(hud.touchControls.joystick.pointerId).toBe(1 + TOUCH_POINTER_ID_OFFSET)

    // Second finger on L2 toggles to Bank 2 (Right-Hand page) without disturbing the joystick.
    expect(mapper.handleTouchStart(2, m.l2PreviewBar.l2Btn.x + 4, m.l2PreviewBar.l2Btn.y + 4, 1020)).toBe('l2Hold')
    expect(hud.touchControls.activeSkillBank).toBe(1)
    expect(hud.touchControls.joystick.active).toBe(true)

    // Stationary held stick keeps emitting forward Move commands from tick().
    const before = sent.filter((c: any) => c.type === 'Move').length
    mapper.tick(1020 + TOUCH_JOYSTICK_REPEAT_MS + 400)
    mapper.tick(1020 + TOUCH_JOYSTICK_REPEAT_MS * 2 + 800)
    const after = sent.filter((c: any) => c.type === 'Move').length
    expect(before).toBeGreaterThan(0)
    expect(after).toBeGreaterThan(before)

    // Releasing L2 stays on Bank 2 (toggle mode default on mobile) and leaves the joystick alone.
    mapper.handleTouchEnd(2, 0, 0, 1500)
    expect(DEFAULT_SKILL_WHEEL_BANK_MODE).toBe('toggle')
    expect(hud.touchControls.activeSkillBank).toBe(1)
    expect(hud.touchControls.joystick.active).toBe(true)

    // Tapping L2 again switches back to Bank 1 (Left-Hand page) and stays on Bank 1 on release.
    expect(mapper.handleTouchStart(2, m.l2PreviewBar.l2Btn.x + 4, m.l2PreviewBar.l2Btn.y + 4, 1520)).toBe('l2Hold')
    mapper.handleTouchEnd(2, 0, 0, 1550)
    expect(hud.touchControls.activeSkillBank).toBe(0)

    mapper.handleTouchEnd(1, 180, 450, 1600)
    expect(hud.touchControls.joystick.active).toBe(false)
    expect(mapper.activeTouches.size).toBe(0)
  })
})

describe('#1967 skill wheel press / vector aim & context interact', () => {
  it('converts a dragged skill wheel press into vector aiming and casts on release', () => {
    const hud = makeTouchHud()
    hud.touchControls.wheelSlots = []
    hud.touchControls.activeSkillBank = 1 // Page 2 = Right-Hand skills
    hud.hotkeys.setAvailableSkills([
      { skillId: 59, name: 'Blizzard', nameZh: '暴风雪', level: 1, manaCost: 23, leftUsable: false, rightUsable: true },
    ])
    hud.hotkeys.bindHotkey('F7', 'right', 59)
    const mapper = makeMapper(hud, [])
    const castAt = vi.spyOn(mapper, 'castTouchSkillAtScreen').mockImplementation(() => {})
    const m = computeCompactD2rHudMetrics(800, 600)
    const arc0 = m.wheel.arcSlots[0]!
    expect(mapper.handleTouchStart(3, arc0.cx, arc0.cy, 2000)).toBe('skillWheel')
    expect(hud.hotkeys.rightSkillId).toBe(59)
    mapper.handleTouchMove(3, arc0.cx - 60, arc0.cy - 10, 2050)
    expect(hud.touchControls.vectorAim?.active).toBe(true)
    mapper.handleTouchEnd(3, arc0.cx - 60, arc0.cy - 10, 2100)
    expect(castAt).toHaveBeenCalledTimes(1)
    expect(hud.touchControls.vectorAim).toBeNull()
  })

  it('[A] context button routes the cone-locked NPC / foot loot through onTouchLootInteract', () => {
    const hud = makeTouchHud()
    const calls: unknown[] = []
    hud.onTouchLootInteract = (t) => calls.push(t)
    hud.touchControls.lockedInteractable = { id: 77, kind: 'npc', label: 'Akara', screenX: 400, screenY: 260 }
    const m = computeCompactD2rHudMetrics(800, 600)
    handleCompactD2rHudClick(hud, m.lootBtn.cx, m.lootBtn.cy)
    expect(calls).toEqual([{ id: 77, kind: 'npc' }])
  })
})

describe('#1968 HUD context switching & zero panel occlusion', () => {
  it('resolves world / panel / dialog / menu contexts', () => {
    const hud = makeTouchHud()
    expect(resolveTouchHudContext(hud)).toBe('world')
    hud.toggleRightPanel('inv')
    expect(resolveTouchHudContext(hud)).toBe('panel')
    hud.worldPanels.escapeMenuOpen = true
    expect(resolveTouchHudContext(hud)).toBe('menu')
  })

  it('never hit-tests combat wheel or joystick over open dock panels', () => {
    const hud = makeTouchHud()
    hud.toggleRightPanel('inv')
    const opts = buildCompactHudLayoutOptions(hud)
    const m = computeCompactD2rHudMetrics(800, 600)
    // Former wheel / belt positions now fall inside the inventory panel area: no compact hit.
    expect(hitTestCompactD2rHud(m.wheel.cx, m.wheel.cy, 800, 600, false, 0, opts)).toBeNull()
    for (let y = 0; y <= 553; y += 23) {
      for (let x = 0; x <= 800; x += 25) {
        const hit = hitTestCompactD2rHud(x, y, 800, 600, false, 0, opts)
        expect(hit).toBeNull()
      }
    }
    // Joystick zone is disabled while a panel is open.
    hud.touchControls.handlePointerDown(1, 60, 500, 800, 600, false)
    expect(isPointInterceptedByHud(hud, 60, 300)).toBe(false)
  })
})

describe('#1969 touch panel actions & wheel skill picker (Page 1 Left Hand / Page 2 Right Hand + Paladin Aura)', () => {
  it('dispatches equip via pickup + equip packets instead of mutating local arrays', () => {
    const hud = makeTouchHud()
    const sink = {
      pickupItemToCursor: vi.fn(),
      equipItem: vi.fn(),
      dropItem: vi.fn(),
      vendorSell: vi.fn(),
    } as unknown as HudCommandSink
    hud.commandSink = sink
    hud.toggleRightPanel('inv')
    const item = helm('42')
    hud.inventory.gridItems.push({ item, col: 0, row: 0 })
    hud.touchControls.selectPanelItem({ source: 'inv', item, col: 0, row: 0, anchorX: 460, anchorY: 340 })
    expect(computeSelectedItemActionBar(hud)?.buttons.some((b) => b.action === 'equip')).toBe(true)
    expect(executeTouchContextAction(hud, 'equip')).toBe(true)
    expect(sink.pickupItemToCursor).toHaveBeenCalledWith(42)
    expect(sink.equipItem).toHaveBeenCalledWith(42, 'helm')
    // Local model is untouched: the server answer drives the inventory.
    expect(hud.inventory.gridItems).toHaveLength(1)
    expect(hud.touchControls.selectedPanelItem).toBeNull()
  })

  it('opens Wheel Skill Picker on short-press when a satellite slot is empty, and on long-press when bound; supports Paladin Aura on Page 2', () => {
    const hud = makeTouchHud(1068, 600)
    const assign = vi.fn()
    const select = vi.fn()
    hud.commandSink = {
      assignSkillHotkey: assign,
      selectSkill: select,
    } as unknown as HudCommandSink
    hud.hotkeys.setAvailableSkills([
      { skillId: 0, name: 'Attack', nameZh: '普通攻击', level: 1, manaCost: 0, leftUsable: true, rightUsable: false },
      { skillId: 106, name: 'Zeal', nameZh: '白热', level: 5, manaCost: 2, leftUsable: true, rightUsable: false },
      { skillId: 112, name: 'Blessed Hammer', nameZh: '祝福之锤', level: 10, manaCost: 7, leftUsable: true, rightUsable: false },
      { skillId: 113, name: 'Concentration', nameZh: '专注', level: 10, manaCost: 0, leftUsable: false, rightUsable: true, isAura: true },
      { skillId: 115, name: 'Vigor', nameZh: '活力', level: 5, manaCost: 0, leftUsable: false, rightUsable: true, isAura: true },
    ])
    const sent: unknown[] = []
    const mapper = makeMapper(hud, sent)
    const m0 = computeCompactD2rHudMetrics(1068, 600, buildCompactHudLayoutOptions(hud))
    const arc0 = m0.wheel.arcSlots[0]!

    // 1. Page 1 (Left Hand): satellite F1 (slot 0) is initially empty (-1).
    expect(hud.touchControls.resolveWheelSlot(0, hud.hotkeys).skillId).toBe(-1)
    // Short-pressing empty satellite F1 opens the Wheel Skill Picker for slot 0 (Left Hand).
    mapper.handleTouchStart(1, arc0.cx, arc0.cy, 1000)
    mapper.handleTouchEnd(1, arc0.cx, arc0.cy, 1080)
    expect(hud.touchControls.wheelPickerSlotIndex).toBe(0)

    const mPickerLeft = computeCompactD2rHudMetrics(1068, 600, buildCompactHudLayoutOptions(hud))
    expect(mPickerLeft.wheelSkillPicker?.side).toBe('left')
    // Left-hand picker offers Blessed Hammer (#112) and Zeal (#106), and excludes Auras (#113, #115).
    expect(mPickerLeft.wheelSkillPicker?.cells.some((c) => c.skillId === 112)).toBe(true)
    expect(mPickerLeft.wheelSkillPicker?.cells.some((c) => c.skillId === 113)).toBe(false)

    // Tap Blessed Hammer (#112) in the picker -> binds F1 (slot 0, left) and sets Page 1 Main Button (leftSkillId = 112).
    const hammerCell = mPickerLeft.wheelSkillPicker!.cells.find((c) => c.skillId === 112)!
    mapper.handleTouchStart(2, hammerCell.x + 8, hammerCell.y + 8, 1200)
    mapper.handleTouchEnd(2, hammerCell.x + 8, hammerCell.y + 8, 1240)
    expect(hud.touchControls.wheelPickerSlotIndex).toBeNull()
    expect(hud.touchControls.resolveWheelSlot(0, hud.hotkeys).skillId).toBe(112)
    expect(hud.touchControls.resolveWheelSlot(5, hud.hotkeys).skillId).toBe(112)
    expect(assign).toHaveBeenCalledWith(0, 'left', 112, undefined)
    expect(select).toHaveBeenCalledWith('left', 112, undefined)

    // 2. Long-pressing (>= 400ms) the now-bound satellite F1 re-opens the Wheel Skill Picker without casting!
    const sentBeforeLongPress = sent.length
    mapper.handleTouchStart(3, arc0.cx, arc0.cy, 2000)
    mapper.tick(2000 + TOUCH_SATELLITE_LONG_PRESS_MS + 20)
    expect(hud.touchControls.wheelPickerSlotIndex).toBe(0)
    expect(sent.length).toBe(sentBeforeLongPress)
    mapper.handleTouchEnd(3, arc0.cx, arc0.cy, 2500)
    // Close the picker
    hud.touchControls.closeWheelSkillPicker()

    // 3. Switch to Page 2 (Right Hand) and bind Concentration Aura (#113) to satellite F7 (slot 6).
    mapper.handleTouchStart(4, m0.l2PreviewBar.l2Btn.x + 4, m0.l2PreviewBar.l2Btn.y + 4, 3000)
    mapper.handleTouchEnd(4, m0.l2PreviewBar.l2Btn.x + 4, m0.l2PreviewBar.l2Btn.y + 4, 3050)
    expect(hud.touchControls.activeSkillBank).toBe(1)

    // Short-tap empty satellite F7 (slot 6) on Page 2 -> opens Right-Hand Wheel Skill Picker.
    mapper.handleTouchStart(5, arc0.cx, arc0.cy, 3100)
    mapper.handleTouchEnd(5, arc0.cx, arc0.cy, 3150)
    expect(hud.touchControls.wheelPickerSlotIndex).toBe(6)
    const mPickerRight = computeCompactD2rHudMetrics(1068, 600, buildCompactHudLayoutOptions(hud))
    expect(mPickerRight.wheelSkillPicker?.side).toBe('right')
    const concCell = mPickerRight.wheelSkillPicker!.cells.find((c) => c.skillId === 113)!
    expect(concCell.isAura).toBe(true)

    // Selecting Concentration (#113) binds F7 (slot 6, right), sets Page 2 Main Button (rightSkillId = 113)
    // to immediately activate the Paladin Aura, and does NOT emit a SkillAt cast packet!
    mapper.handleTouchStart(6, concCell.x + 8, concCell.y + 8, 3200)
    mapper.handleTouchEnd(6, concCell.x + 8, concCell.y + 8, 3240)
    expect(hud.hotkeys.rightSkillId).toBe(113)
    expect(hud.touchControls.resolveWheelSlot(11, hud.hotkeys).skillId).toBe(113)
    expect(select).toHaveBeenCalledWith('right', 113, undefined)

    // Switching back to Page 1 (Left Hand) keeps Concentration Aura (#113) active on Right Hand while casting Blessed Hammer (#112) on Left Hand!
    mapper.handleTouchStart(7, m0.l2PreviewBar.l2Btn.x + 4, m0.l2PreviewBar.l2Btn.y + 4, 3300)
    mapper.handleTouchEnd(7, m0.l2PreviewBar.l2Btn.x + 4, m0.l2PreviewBar.l2Btn.y + 4, 3340)
    expect(hud.touchControls.activeSkillBank).toBe(0)
    expect(hud.hotkeys.rightSkillId).toBe(113)
    expect(hud.touchControls.resolveWheelSlot(5, hud.hotkeys).skillId).toBe(112)
  })
})

describe('#1970 touch cursor & art', () => {
  it('hides the gauntlet cursor on touch unless it carries meaning', () => {
    const hud = makeTouchHud()
    expect(isTouchCursorHidden(hud)).toBe(true)
    hud.inventory.cursorItem = helm('9')
    expect(isTouchCursorHidden(hud)).toBe(false)
    const desktop = new HudManager(createMockHudCanvas())
    expect(isTouchCursorHidden(desktop)).toBe(false)
  })

  it('keeps the [A] button and satellite wheel clear of the right globe on 800x600', () => {
    const m = computeCompactD2rHudMetrics(800, 600)
    const dLoot = Math.hypot(m.lootBtn.cx - m.rightGlobe.cx, m.lootBtn.cy - m.rightGlobe.cy)
    expect(dLoot).toBeGreaterThan(m.lootBtn.r + m.rightGlobe.r)
    for (const arc of m.wheel.arcSlots) {
      const dArc = Math.hypot(arc.cx - m.rightGlobe.cx, arc.cy - m.rightGlobe.cy)
      expect(dArc).toBeGreaterThan(arc.r + m.rightGlobe.r)
    }
    expect(m.wheel.arcSlots[0]!.cx - m.wheel.arcSlots[0]!.r).toBeGreaterThan(m.rightGlobe.cx + m.rightGlobe.r)
  })

  it('TouchControlsHud defaults to toggle bank mode for mobile ergonomics', () => {
    expect(new TouchControlsHud().skillWheelBankMode).toBe('toggle')
  })

  it('quick-tapping a directional skill (Teleport #54 / Blizzard #59) on Main button casts forward instead of at own feet, while hold repeats', () => {
    const hud = makeTouchHud(1068, 600)
    hud.touchControls.activeSkillBank = 1
    hud.hotkeys.setAvailableSkills([
      { skillId: 54, name: 'Teleport', nameZh: '传送', level: 1, manaCost: 24, leftUsable: false, rightUsable: true },
    ])
    hud.hotkeys.rightSkillId = 54
    const sent: unknown[] = []
    const mapper = makeMapper(hud, sent)
    const castForward = vi.spyOn(mapper, 'castTouchWheelSkill')
    const castAtScreen = vi.spyOn(mapper, 'castTouchSkillAtScreen')
    const m = computeCompactD2rHudMetrics(1068, 600)

    // Quick tap without dragging -> casts forward via castTouchWheelSkill (NOT at player's own feet via castTouchSkillAtScreen)
    mapper.handleTouchStart(1, m.wheel.cx, m.wheel.cy, 1000)
    mapper.handleTouchEnd(1, m.wheel.cx, m.wheel.cy, 1060)
    expect(castForward).toHaveBeenCalledTimes(1)
    expect(castAtScreen).toHaveBeenCalledTimes(0)
  })

  it('non-directional skill hold-repeat is not interrupted by slight thumb jitter (>= 18px)', () => {
    const hud = makeTouchHud(1068, 600)
    hud.hotkeys.setAvailableSkills([
      { skillId: 112, name: 'Blessed Hammer', nameZh: '祝福之锤', level: 5, manaCost: 7, leftUsable: true, rightUsable: false },
    ])
    hud.hotkeys.leftSkillId = 112
    const sent: unknown[] = []
    const mapper = makeMapper(hud, sent)
    const castForward = vi.spyOn(mapper, 'castTouchWheelSkill').mockImplementation(() => {})
    const m = computeCompactD2rHudMetrics(1068, 600)

    mapper.handleTouchStart(1, m.wheel.cx, m.wheel.cy, 1000)
    expect(castForward).toHaveBeenCalledTimes(1)
    // Jitter thumb by 24px while holding: non-directional skill must NOT enter vectorAim
    mapper.handleTouchMove(1, m.wheel.cx + 24, m.wheel.cy, 1100)
    expect(hud.touchControls.vectorAim).toBeNull()
    mapper.tick(1250)
    expect(castForward).toHaveBeenCalledTimes(2)
    mapper.handleTouchEnd(1, m.wheel.cx + 24, m.wheel.cy, 1300)
    // Releasing after hold-repeat does not fire an extra duplicate cast on release
    expect(castForward).toHaveBeenCalledTimes(2)
  })

  it('800x600 expanded 4x4 popbelt column 0 is routed to hud drinkBeltSlot instead of left joystick', () => {
    const hud = makeTouchHud(800, 600)
    hud.belt.setEquippedBelt('tbl')
    hud.belt.lockedOpen = true
    expect(hud.belt.isExpanded).toBe(true)
    hud.belt.setSlot(0, 1, { code: 'hp1', name: 'Minor Healing Potion', type: 'health' } as never)
    const mapper = makeMapper(hud, [])
    const m = computeCompactD2rHudMetrics(800, 600)
    const col0X = m.beltSlots[0]!.x + 10
    const row1Y = m.beltSlots[0]!.y - (m.beltSlots[0]!.size + 4) + 10
    const kind = mapper.handleTouchStart(1, col0X, row1Y, 1000)
    expect(kind).toBe('hud')
    expect(hud.touchControls.joystick.active).toBe(false)
  })
})
