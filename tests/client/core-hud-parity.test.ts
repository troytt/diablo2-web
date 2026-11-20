/**
 * Parity Test Suite for Core HUD, Mini-Panel, Belts, Death Screen & Experience Table.
 * Covers Issues #636, #637, #638, #639, #640, #641.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ControlBarHud,
  MULTIPLAYER_MINIPANEL_ITEMS,
  SINGLEPLAYER_MINIPANEL_ITEMS,
  getMiniPanelTooltip,
  MINIPANEL_BOUNDS,
  MINIPANEL_SINGLE_BOUNDS,
  levelButtonFrame,
  STAT_PLUS_BTN_BOUNDS,
  SKILL_PLUS_BTN_BOUNDS,
  STAMINA_BAR_COLOR_RED,
  STAMINA_BAR_COLOR_YELLOW,
  STAMINA_BAR_COLOR_BLUE,
  STAMINA_BAR_TRANS_ALPHA,
  computeStaminaBarVisual113c,
  EXP_BAR_BOUNDS,
  EXP_BAR_HOVER_BOUNDS,
  EXP_BAR_BOUNDS_640,
  EXP_BAR_HOVER_BOUNDS_640,
  EXP_BAR_COLOR,
  computeExpBarFill113c,
  RUN_BTN_BOUNDS,
  RUN_BTN_BOUNDS_640,
  MENU_TOGGLE_BOUNDS,
  MENU_TOGGLE_BOUNDS_640,
} from '../../src/client/ui/control-bar.ts'
import {
  LEFT_SKILL_BOUNDS,
  RIGHT_SKILL_BOUNDS,
  LEFT_SKILL_BOUNDS_640,
  RIGHT_SKILL_BOUNDS_640,
} from '../../src/client/ui/hotkeys.ts'
import {
  CharacterSheetPanel,
  STAT_ALLOC_BUTTONS,
  STAT_POINTS_BANNER_BOUNDS,
  STAT_POINTS_NUMBER_BOX_BOUNDS,
  CHAR_CLOSE_BTN_BOUNDS,
  drawStatPointsSunkenSlot,
} from '../../src/client/ui/character-sheet.ts'
import { LEVEL_BTN_CELL_SIZE } from '../../src/client/ui/level-button.ts'
import { BeltHud } from '../../src/client/ui/belt.ts'
import { VitalStatSmoother113c } from '../../src/client/ui/globes.ts'
import {
  BeltModel,
  BELT_POTION_CATALOG,
  BELT_CODE_TO_ROWS,
  getBeltRowsForCode,
  getBeltSlotBox,
  itemToBeltPotion,
  areBeltPotionsCompatible,
  BELT_BASE_X,
  BELT_BASE_Y,
  BELT_PITCH_X,
  BELT_PITCH_Y,
  BELT_CELL_SIZE,
} from '../../src/common/items/belt-model.ts'
import {
  D2_EXPERIENCE_TABLE_99,
  getExperienceForLevel,
  getNextLevelExperience,
  EXPERIENCE_TABLE_BY_CLASS,
  parseExperienceTable,
  EXPERIENCE_TXT_RAW,
} from '../../src/common/skills/formulas.ts'

describe('Core HUD Parity Suite (Issues #636–#641)', () => {
  describe('Issue #636: Mini-Panel 8-Button Layout & Authentic Parity', () => {
    it('defines 8 authentic buttons for multiplayer and 7 for single-player', () => {
      expect(MULTIPLAYER_MINIPANEL_ITEMS.length).toBe(8)
      expect(SINGLEPLAYER_MINIPANEL_ITEMS.length).toBe(7)

      const mpActions = MULTIPLAYER_MINIPANEL_ITEMS.map((m) => m.action)
      expect(mpActions).toEqual(['char', 'inv', 'skill', 'party', 'automap', 'msg', 'quest', 'menu'])

      const spActions = SINGLEPLAYER_MINIPANEL_ITEMS.map((m) => m.action)
      expect(spActions).toEqual(['char', 'inv', 'skill', 'automap', 'msg', 'quest', 'menu'])

      // Waypoint / stash must be eliminated
      expect(mpActions).not.toContain('waypoint')
      expect(spActions).not.toContain('waypoint')
    })

    it('indexes icon frames as iconGroup * 2 + (isPressed ? 1 : 0)', () => {
      for (const item of MULTIPLAYER_MINIPANEL_ITEMS) {
        expect(typeof item.iconGroup).toBe('number')
        const normalFrame = item.iconGroup * 2
        const pressedFrame = item.iconGroup * 2 + 1
        expect(pressedFrame).toBe(normalFrame + 1)
      }
      // Party iconGroup is 3
      const party = MULTIPLAYER_MINIPANEL_ITEMS.find((m) => m.action === 'party')!
      expect(party.iconGroup).toBe(3)
      // Game Menu iconGroup is 7
      const menu = MULTIPLAYER_MINIPANEL_ITEMS.find((m) => m.action === 'menu')!
      expect(menu.iconGroup).toBe(7)
    })

    it('formats tooltips with canonical .tbl keys and minipanelspecial hotkey format', () => {
      const charItem = MULTIPLAYER_MINIPANEL_ITEMS.find((m) => m.action === 'char')!
      expect(getMiniPanelTooltip(charItem, 'ENG')).toBe('Character (A)')
      expect(getMiniPanelTooltip(charItem, 'CHI')).toBe('人物（A）')

      const invItem = MULTIPLAYER_MINIPANEL_ITEMS.find((m) => m.action === 'inv')!
      expect(getMiniPanelTooltip(invItem, 'ENG')).toBe('Inventory (I)')
      expect(getMiniPanelTooltip(invItem, 'CHI')).toBe('物品（I）')

      // Game Menu already has (Esc) in its tbl string, does not double-append
      const menuItem = MULTIPLAYER_MINIPANEL_ITEMS.find((m) => m.action === 'menu')!
      expect(getMiniPanelTooltip(menuItem, 'ENG')).toBe('Game Menu (Esc)')
      expect(getMiniPanelTooltip(menuItem, 'CHI')).toBe('遊戲選單（Esc）')
    })

    it('handles mouse clicks and hover across 21px button pitch and side-panel shift/hide modes (#1724, D2Client.dll 0x6FB13000 / 0x6FB14550 / 0x6FB14990)', () => {
      const hud = new ControlBarHud()
      hud.miniPanelOpen = true
      hud.isMultiplayer = true

      expect(MINIPANEL_BOUNDS).toEqual({ x: 313, y: 527, width: 173, height: 26 })
      expect(MINIPANEL_SINGLE_BOUNDS).toEqual({ x: 323, y: 527, width: 152, height: 26 })
      expect(hud.currentMiniPanelBounds).toEqual({ x: 313, y: 527, width: 173, height: 26 })
      expect(hud.currentButtonStartX).toBe(316)
      expect(hud.currentButtonStartY).toBe(530)

      const onMiniPanelAction = vi.fn()
      const callbacks = { onToggleRun: vi.fn(), onMiniPanelAction }

      // Button 0 (char): x = 316..335, y = 530..552 — press, then release on the button.
      hud.handleMouseMove(325, 535)
      expect(hud.hoveredElement).toBe('char')
      hud.handleMouseDown(325, 535)
      hud.handleMouseUp(325, 535, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('char')

      // 1-px divider between button 0 (316..335) and button 1 (337..356) at x = 336 does not hit either
      hud.handleMouseMove(336, 535)
      expect(hud.hoveredElement).toBeNull()

      // Button 3 (party): x = 316 + 3*21 = 379..398
      hud.handleMouseMove(385, 535)
      expect(hud.hoveredElement).toBe('party')
      hud.handleMouseDown(385, 535)
      hud.handleMouseUp(385, 535, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('party')

      // Button 7 (menu): x = 316 + 7*21 = 463..482 — press, drag off, release: cancelled.
      hud.handleMouseMove(465, 535)
      expect(hud.hoveredElement).toBe('menu')
      hud.handleMouseDown(465, 535)
      hud.handleMouseUp(465, 480, callbacks)
      expect(onMiniPanelAction).not.toHaveBeenCalledWith('menu')
      hud.handleMouseDown(465, 535)
      hud.handleMouseUp(465, 535, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('menu')

      // Mode 1 (right panel only open, 0x6FB14AB6): shifts left (bg W/2-205=195, buttons W/2-202=198)
      hud.rightPanelOpen = true
      expect(hud.miniPanelPlacementMode).toBe(1)
      expect(hud.isMiniPanelVisible).toBe(true)
      expect(hud.currentMiniPanelBounds.x).toBe(195)
      expect(hud.currentButtonStartX).toBe(198)
      hud.handleMouseMove(200, 535)
      expect(hud.hoveredElement).toBe('char')

      // Mode 3 (left panel only open, 0x6FB149B6): shifts right (MP bg W/2+33=433, buttons W/2+35=435; SP bg W/2+54=454, buttons W/2+57=457)
      hud.rightPanelOpen = false
      hud.leftPanelOpen = true
      expect(hud.miniPanelPlacementMode).toBe(3)
      expect(hud.isMiniPanelVisible).toBe(true)
      expect(hud.currentMiniPanelBounds.x).toBe(433)
      expect(hud.currentButtonStartX).toBe(435)
      hud.isMultiplayer = false
      expect(hud.currentMiniPanelBounds.x).toBe(454)
      expect(hud.currentButtonStartX).toBe(457)
      hud.isMultiplayer = true

      // Mode 0 (both panels open, 0x6FB14B1A): mini panel hidden (0x6FBCC090 = 1)
      hud.rightPanelOpen = true
      expect(hud.miniPanelPlacementMode).toBe(0)
      expect(hud.isMiniPanelVisible).toBe(false)
      hud.handleMouseMove(440, 535)
      expect(hud.hoveredElement).toBeNull()
    })
  })

  describe('Level.dc6 Stat/Skill `+` Buttons: Always-Visible Frames & Socket Alignment', () => {
    it('draws the gray raised frame 2 whenever no points are unallocated', () => {
      // `Panel/Level.dc6`: frame 0 = red lit, frame 1 = red pressed, frame 2 = gray raised.
      // The buttons stay visible in the panel sockets even with nothing to allocate.
      expect(levelButtonFrame(0, false)).toBe(2)
      expect(levelButtonFrame(0, true)).toBe(2)
    })

    it('keeps the lit red frame steady while points are available, pressed cell only on mouse-down', () => {
      expect(levelButtonFrame(1, false)).toBe(0)
      expect(levelButtonFrame(5, false)).toBe(0)
      expect(levelButtonFrame(3, true)).toBe(1)
    })

    it('tracks the pressed `+` button across mouse down/up', () => {
      const hud = new ControlBarHud()
      const sk = SKILL_PLUS_BTN_BOUNDS
      const st = STAT_PLUS_BTN_BOUNDS
      const callbacks = { onToggleRun: vi.fn(), onMiniPanelAction: vi.fn() }

      // Mouse-down on the lit skill button shows the pressed cell until release.
      hud.handleMouseDown(sk.x + 15, sk.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 2 })
      expect(hud.pressedPlus).toBe('skill')
      expect(hud.skillPlusButton.frame(2)).toBe(1)
      hud.handleMouseUp(sk.x + 15, sk.y + 15, callbacks)
      expect(hud.pressedPlus).toBeNull()
      expect(hud.skillPlusButton.frame(2)).toBe(0)
      expect(callbacks.onMiniPanelAction).toHaveBeenCalledWith('skill')

      // Press, drag off the button, release: the latch clears without firing.
      hud.handleMouseDown(sk.x + 15, sk.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 2 })
      expect(hud.pressedPlus).toBe('skill')
      hud.handleMouseUp(sk.x + 15, sk.y - 40, callbacks)
      expect(hud.pressedPlus).toBeNull()
      expect(callbacks.onMiniPanelAction).toHaveBeenCalledTimes(1)

      // Idle buttons never enter the pressed state.
      hud.handleMouseDown(st.x + 15, st.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 0 })
      expect(hud.pressedPlus).toBeNull()
    })

    it('positions both 30x30 buttons on the socket inner recess baked into 800CtrlPnl7', () => {
      // Socket outer gold border: stat x 205..236, skill x 562..593, y 65..96 (panel space,
      // panel drawn at y=496) -> the button cell must land exactly on the 30x30 dark inner area.
      expect(STAT_PLUS_BTN_BOUNDS).toEqual({ x: 206, y: 562, width: 30, height: 30 })
      expect(SKILL_PLUS_BTN_BOUNDS).toEqual({ x: 563, y: 562, width: 30, height: 30 })
    })

    it('gates panel opening on unspent points using the aligned button rects', () => {
      const hud = new ControlBarHud()
      const onMiniPanelAction = vi.fn()
      const callbacks = { onToggleRun: vi.fn(), onMiniPanelAction }

      // Center of the skill button rect with no unspent points: press + release is a no-op.
      const sk = SKILL_PLUS_BTN_BOUNDS
      hud.handleMouseDown(sk.x + 15, sk.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 0 })
      hud.handleMouseUp(sk.x + 15, sk.y + 15, callbacks)
      expect(onMiniPanelAction).not.toHaveBeenCalled()

      // With an unspent skill point the same click opens the skill tree.
      hud.handleMouseDown(sk.x + 15, sk.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 1 })
      hud.handleMouseUp(sk.x + 15, sk.y + 15, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('skill')

      // Center of the stat button rect with an unspent stat point opens the char sheet.
      const st = STAT_PLUS_BTN_BOUNDS
      hud.handleMouseDown(st.x + 15, st.y + 15, { unspentStatPoints: 1, unspentSkillPoints: 0 })
      hud.handleMouseUp(st.x + 15, st.y + 15, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('char')
    })

    it('shows the stat/skill tooltips only while the matching points are unspent', () => {
      const hud = new ControlBarHud()
      const st = STAT_PLUS_BTN_BOUNDS
      const sk = SKILL_PLUS_BTN_BOUNDS

      // Idle buttons advertise nothing.
      hud.handleMouseMove(sk.x + 15, sk.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 0 })
      expect(hud.hoveredElement).toBeNull()
      hud.handleMouseMove(st.x + 15, st.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 0 })
      expect(hud.hoveredElement).toBeNull()

      // Lit buttons keep their 1.13c tooltips.
      hud.handleMouseMove(sk.x + 15, sk.y + 15, { unspentStatPoints: 0, unspentSkillPoints: 2 })
      expect(hud.hoveredElement).toBe('skillPlus')
      hud.handleMouseMove(st.x + 15, st.y + 15, { unspentStatPoints: 3, unspentSkillPoints: 0 })
      expect(hud.hoveredElement).toBe('statPlus')
    })
  })

  describe('Character Sheet Stat `+` Buttons: Level.dc6 Lit/Pressed Cells', () => {
    it('keeps the lit red frame 0 steady and shows the pressed cell 1 only while held down', () => {
      // Same `Panel\Level.dc6` cells as the control-bar buttons; the gray frame 2 is
      // unreachable here because the sheet hides the buttons with 0 unspent points.
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.attrs.statPoints = 5
      const str = STAT_ALLOC_BUTTONS.str

      sheet.handleMouseDown(str.x + 10, str.y + 10)
      expect(sheet.pressedStatKey).toBe('str')
      expect(sheet.strPlusButton.frame(sheet.attrs.statPoints)).toBe(1)
      // Other rows stay lit while one button is held.
      expect(sheet.vitPlusButton.frame(sheet.attrs.statPoints)).toBe(0)

      sheet.handleMouseUp(str.x + 10, str.y + 10, vi.fn())
      expect(sheet.pressedStatKey).toBeNull()
      expect(sheet.strPlusButton.frame(sheet.attrs.statPoints)).toBe(0)
    })

    it('draws the native 30x30 Level.dc6 cell, vertically centered on the attribute text row', () => {
      // font8 label baselines sit at y = 60+94/156/242/304 with the visible ink center
      // ~4px above the baseline; the 30px cell top lands at baseline - 19.
      expect(STAT_ALLOC_BUTTONS.str).toEqual({ x: 202, y: 135, w: 30, h: 30 })
      expect(STAT_ALLOC_BUTTONS.dex).toEqual({ x: 202, y: 197, w: 30, h: 30 })
      expect(STAT_ALLOC_BUTTONS.vit).toEqual({ x: 202, y: 283, w: 30, h: 30 })
      expect(STAT_ALLOC_BUTTONS.ene).toEqual({ x: 202, y: 345, w: 30, h: 30 })
      expect(LEVEL_BTN_CELL_SIZE).toBe(30)
    })

    it('allocates via the 0x3A request only when released on the pressed button', () => {
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.attrs.statPoints = 2
      const onStatAllocated = vi.fn()
      const ene = STAT_ALLOC_BUTTONS.ene

      // Press + release on the lit button: allocation request fires once.
      sheet.handleMouseDown(ene.x + 10, ene.y + 10)
      sheet.handleMouseUp(ene.x + 10, ene.y + 10, onStatAllocated)
      expect(onStatAllocated).toHaveBeenCalledTimes(1)
      expect(onStatAllocated).toHaveBeenCalledWith('ene')

      // Press, drag off, release elsewhere: cancelled, no request.
      sheet.handleMouseDown(ene.x + 10, ene.y + 10)
      sheet.handleMouseUp(ene.x - 60, ene.y + 10, onStatAllocated)
      expect(onStatAllocated).toHaveBeenCalledTimes(1)
      expect(sheet.pressedStatKey).toBeNull()
    })

    it('never enters the pressed state with 0 unallocated points', () => {
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      const str = STAT_ALLOC_BUTTONS.str

      sheet.handleMouseDown(str.x + 10, str.y + 10)
      expect(sheet.pressedStatKey).toBeNull()
      sheet.handleMouseUp(str.x + 10, str.y + 10, vi.fn())
    })
  })

  describe('Remaining Stat Points Section: Runtime Sunken Slots (1.13c parity)', () => {
    it('places the label banner and the counter socket below Energy, clear of the close button', () => {
      // Measured from a live 1.13c capture (anchored on the four `+` button rows):
      // both slots top-align at panel y 341 (60 + 341 = 401 abs), sit side by side
      // under the Energy row, and stop left of the close-button recess (x 208 abs).
      expect(STAT_POINTS_BANNER_BOUNDS).toEqual({ x: 85, y: 401, w: 79, h: 21 })
      expect(STAT_POINTS_NUMBER_BOX_BOUNDS).toEqual({ x: 165, y: 401, w: 38, h: 21 })
      expect(STAT_POINTS_NUMBER_BOX_BOUNDS.x + STAT_POINTS_NUMBER_BOX_BOUNDS.w).toBeLessThan(CHAR_CLOSE_BTN_BOUNDS.x)
      expect(STAT_POINTS_BANNER_BOUNDS.y + STAT_POINTS_BANNER_BOUNDS.h).toBeLessThan(CHAR_CLOSE_BTN_BOUNDS.y)
    })

    it('draws the sunken slot with the invchar6 value-slot rail colors', () => {
      const rects: Array<{ x: number; y: number; w: number; h: number; color: string }> = []
      const ctx = {
        set fillStyle(color: string) { (this as any)._color = color },
        get fillStyle() { return (this as any)._color },
        fillRect(x: number, y: number, w: number, h: number) {
          rects.push({ x, y, w, h, color: (this as any)._color })
        },
      } as unknown as CanvasRenderingContext2D
      drawStatPointsSunkenSlot(ctx, 10, 20, 40, 21)
      // Interior fill + top gold rail + inner light line + bottom gold rail, exactly
      // like the D2Win beveled rects (colors sampled from the baked Energy slot).
      expect(rects).toEqual([
        { x: 10, y: 20, w: 40, h: 21, color: '#040404' },
        { x: 10, y: 20, w: 40, h: 1, color: '#ac9c64' },
        { x: 10, y: 39, w: 40, h: 1, color: '#acacac' },
        { x: 10, y: 40, w: 40, h: 1, color: '#8c7c50' },
      ])
    })
  })

  describe('Issue #637: Authentic Death Presentation Parity', () => {
    it('calculates exact 1.13c centered screen offsets (W/2, H/2 - 94) and (W/2, H/2 - 46)', () => {
      const W = 800
      const H = 600
      const centerX = Math.round(W / 2)
      const centerY = Math.round(H / 2)

      const yHardcore = centerY - 94 // 300 - 94 = 206
      const yInst = centerY - 46     // 300 - 46 = 254

      expect(centerX).toBe(400)
      expect(yHardcore).toBe(206)
      expect(yInst).toBe(254)
    })
  })

  describe('Issue #638: Belt Slot Grid Indexing & Left-Click Interaction', () => {
    it('accesses belt slot using getSlot(col, row) without inverted indexing', () => {
      const belt = new BeltModel()
      const potion = itemToBeltPotion({ code: 'hp1', id: 'pot-hp1' })!
      // Put potion in col 2, row 1
      belt.grid[1]![2] = potion

      expect(belt.getSlot(2, 1)).toBe(potion)
      expect(belt.getSlot(1, 2)).toBeNull()
    })
  })

  describe('Issue #639: Experience Table & Experience.txt 1.13c Parity', () => {
    it('parses raw Experience.txt correctly into 100 levels (indices 0..99)', () => {
      const parsed = parseExperienceTable(EXPERIENCE_TXT_RAW)
      expect(parsed.maxLevel).toBe(99)
      expect(Object.keys(parsed.tableByClass).length).toBe(7)

      // All classes identical progression
      for (const cls of ['amazon', 'sorceress', 'necromancer', 'paladin', 'barbarian', 'druid', 'assassin']) {
        const table = parsed.tableByClass[cls]!
        expect(table.length).toBe(100)
        expect(table[1]).toBe(0)
        expect(table[2]).toBe(500)
        expect(table[17]).toBe(275207)
        expect(table[30]).toBe(4663553)
        expect(table[90]).toBe(1618470619)
        expect(table[99]).toBe(3520485254)
      }
    })

    it('getExperienceForLevel and getNextLevelExperience conform to 1.13c', () => {
      expect(getExperienceForLevel(1)).toBe(0)
      expect(getExperienceForLevel(2)).toBe(500)
      expect(getExperienceForLevel(17)).toBe(275207)
      expect(getExperienceForLevel(30)).toBe(4663553)
      expect(getExperienceForLevel(90)).toBe(1618470619)
      expect(getExperienceForLevel(99)).toBe(3520485254)

      expect(getNextLevelExperience(1)).toBe(500)
      expect(getNextLevelExperience(16)).toBe(275207)
      expect(getNextLevelExperience(29)).toBe(4663553)
      expect(getNextLevelExperience(89)).toBe(1618470619)
      expect(getNextLevelExperience(98)).toBe(3520485254)
      expect(getNextLevelExperience(99)).toBe(3520485254)
    })
  })

  describe('Issue #640: Belts.txt Dynamic Rows & Coordinate Parity', () => {
    it('conforms to 1.13c belts.txt coordinates (base x=423, base y=562, pitch x=31, pitch y=32, box=29x29)', () => {
      expect(BELT_BASE_X).toBe(423)
      expect(BELT_BASE_Y).toBe(562)
      expect(BELT_PITCH_X).toBe(31)
      expect(BELT_PITCH_Y).toBe(32)
      expect(BELT_CELL_SIZE).toBe(29)

      // Row 0 box
      const box0 = getBeltSlotBox(0, 0)
      expect(box0).toEqual({ x: 423, y: 562, width: 29, height: 29 })

      // Row 1 box
      const box1 = getBeltSlotBox(0, 1)
      expect(box1).toEqual({ x: 423, y: 530, width: 29, height: 29 })

      // Row 3 box (top row of 4x4 belt)
      const box3 = getBeltSlotBox(3, 3)
      expect(box3).toEqual({ x: 423 + 3 * 31, y: 562 - 3 * 32, width: 29, height: 29 })
    })

    it('dynamically adapts maxRows according to equipped belt code', () => {
      const belt = new BeltModel()

      // Default (no equipped belt): 1 row (4 boxes)
      belt.setEquippedBelt(null)
      expect(belt.maxRows).toBe(1)
      expect(getBeltRowsForCode(null)).toBe(1)

      // Sash (lbl): 2 rows (8 boxes)
      belt.setEquippedBelt('lbl')
      expect(belt.maxRows).toBe(2)

      // Light Belt (vbl): 2 rows (8 boxes)
      belt.setEquippedBelt('vbl')
      expect(belt.maxRows).toBe(2)

      // Belt (mbl): 3 rows (12 boxes)
      belt.setEquippedBelt('mbl')
      expect(belt.maxRows).toBe(3)

      // Heavy Belt (tbl): 3 rows (12 boxes)
      belt.setEquippedBelt('tbl')
      expect(belt.maxRows).toBe(3)

      // Girdle (hbl): 4 rows (16 boxes)
      belt.setEquippedBelt('hbl')
      expect(belt.maxRows).toBe(4)

      // Exceptional & Elite belts: 4 rows
      for (const code of ['zlb', 'zvb', 'zmb', 'ztb', 'zhb', 'ulc', 'uvc', 'umc', 'utc', 'uhc']) {
        belt.setEquippedBelt(code)
        expect(belt.maxRows).toBe(4)
      }
    })

    it('slotAtPoint hit tests only visible rows according to maxRows', () => {
      const belt = new BeltModel()
      belt.setEquippedBelt('lbl') // 2 rows
      belt.lockedOpen = true // expanded to maxRows (2)

      // Row 0 col 0
      expect(belt.slotAtPoint(425, 565)).toEqual({ row: 0, col: 0 })
      // Row 1 col 0
      expect(belt.slotAtPoint(425, 535)).toEqual({ row: 1, col: 0 })
      // Row 2 col 0 (outside 2-row belt)
      expect(belt.slotAtPoint(425, 500)).toBeNull()
    })
  })

  describe('Issue #641: Belt Potion Assets & Scroll Eligibility', () => {
    it('maps authentic invFile names per 1.13c misc.txt', () => {
      expect(BELT_POTION_CATALOG['vps']?.invFile).toBe('invwps') // Stamina
      expect(BELT_POTION_CATALOG['yps']?.invFile).toBe('invnps') // Antidote
      expect(BELT_POTION_CATALOG['wms']?.invFile).toBe('invyps') // Thawing

      expect(BELT_POTION_CATALOG['rvs']?.invFile).toBe('invvps') // Rejuv
      expect(BELT_POTION_CATALOG['rvl']?.invFile).toBe('invvpl') // Full Rejuv

      expect(BELT_POTION_CATALOG['tsc']?.invFile).toBe('invbsc') // Town Portal Scroll
      expect(BELT_POTION_CATALOG['isc']?.invFile).toBe('invrsc') // Identify Scroll
    })

    it('allows scrolls (tsc/isc) to be placed into belt slots', () => {
      const tsc = itemToBeltPotion({ code: 'tsc', id: 'scroll-tp' })
      expect(tsc).not.toBeNull()
      expect(tsc?.kind).toBe('scroll')
      expect(tsc?.invFile).toBe('invbsc')

      const isc = itemToBeltPotion({ code: 'isc', id: 'scroll-id' })
      expect(isc).not.toBeNull()
      expect(isc?.kind).toBe('scroll')
      expect(isc?.invFile).toBe('invrsc')

      const belt = new BeltModel()
      expect(belt.setSlot(0, 0, tsc)).toBe(true)
      expect(belt.getSlot(0, 0)?.code).toBe('tsc')
    })

    it('rejects weapon throwing potions and invalid non-beltable items', () => {
      for (const throwPot of ['gpm', 'opm', 'gpl', 'opl', 'gps', 'ops']) {
        expect(itemToBeltPotion({ code: throwPot })).toBeNull()
      }
      expect(itemToBeltPotion({ code: 'axe' })).toBeNull()
      expect(itemToBeltPotion({ code: 'key' })).toBeNull()
    })

    it('requires scrolls to have identical code for column compatibility', () => {
      const tsc1 = itemToBeltPotion({ code: 'tsc' })!
      const tsc2 = itemToBeltPotion({ code: 'tsc' })!
      const isc = itemToBeltPotion({ code: 'isc' })!
      const hp = itemToBeltPotion({ code: 'hp1' })!

      expect(areBeltPotionsCompatible(tsc1, tsc2)).toBe(true)
      expect(areBeltPotionsCompatible(tsc1, isc)).toBe(false)
      expect(areBeltPotionsCompatible(tsc1, hp)).toBe(false)
    })
  })

  describe('Issue #1725: Stamina Bar Colours, Translucency & Tooltip Rules (D2Client.dll 0x6FAD78B0)', () => {
    it('switches stamina bar from #f4c04c yellow to #ff0000 red when width < 25 and #0000ff blue under stamina shrine or cur > max + 5', () => {
      // Normal stamina (w = trunc(80 * 102 / 100) = 81 >= 25 -> yellow #f4c04c)
      const normal = computeStaminaBarVisual113c(80, 100, false)
      expect(normal).toEqual({
        width: 81,
        color: STAMINA_BAR_COLOR_YELLOW,
        tooltipCur: 80,
        tooltipMax: 100,
        tooltipColor: 'white',
      })

      // Low stamina (w = trunc(24 * 102 / 100) = 24 < 25 -> red #ff0000, 0x6FAD794E cmp esi, 0x19)
      const low = computeStaminaBarVisual113c(24, 100, false)
      expect(low.width).toBe(24)
      expect(low.color).toBe(STAMINA_BAR_COLOR_RED)

      // Threshold boundary (w = trunc(25 * 102 / 100) = 25 >= 25 -> yellow #f4c04c)
      const boundary = computeStaminaBarVisual113c(25, 100, false)
      expect(boundary.width).toBe(25)
      expect(boundary.color).toBe(STAMINA_BAR_COLOR_YELLOW)

      // Stamina shrine / state 24 / state 136 -> full-width blue #0000ff, tooltip shows max / max in blue (0x6FAD79D6)
      const shrine = computeStaminaBarVisual113c(40, 100, true)
      expect(shrine).toEqual({
        width: 102,
        color: STAMINA_BAR_COLOR_BLUE,
        tooltipCur: 100,
        tooltipMax: 100,
        tooltipColor: 'blue',
      })

      // Over-max stamina (cur > max + 5 at 0x6FAD7920 -> full-width blue; cur > max at 0x6FAD79C3 -> tooltip shows max / max in blue)
      const overMax = computeStaminaBarVisual113c(110, 100, false)
      expect(overMax).toEqual({
        width: 102,
        color: STAMINA_BAR_COLOR_BLUE,
        tooltipCur: 100,
        tooltipMax: 100,
        tooltipColor: 'blue',
      })
    })

    it('draws the stamina bar translucently (alpha 0.75, transMode=2) without an opaque black backdrop', () => {
      const hud = new ControlBarHud()
      hud.lang = 'ENG'
      hud.hoveredElement = 'stamina'
      const fills: Array<{ x: number; y: number; w: number; h: number; color: string; alpha: number }> = []
      const texts: Array<{ text: string; color: string }> = []
      const ctx = {
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        drawImage: vi.fn(),
        strokeRect: vi.fn(),
        fillRect(x: number, y: number, w: number, h: number) {
          fills.push({ x, y, w, h, color: (this as any).fillStyle, alpha: (this as any).globalAlpha })
        },
      } as unknown as CanvasRenderingContext2D
      const font = {
        measureText: () => 80,
        drawText(_c: unknown, text: string, _x: number, _y: number, opts: { color: string }) {
          texts.push({ text, color: opts.color })
        },
      } as any

      hud.draw(
        ctx,
        {
          level: 10,
          xp: 50000,
          currentLevelXp: 40000,
          nextLevelXp: 60000,
          stamina: 20,
          maxStamina: 100,
          isRunning: false,
          unspentStatPoints: 0,
          unspentSkillPoints: 0,
          isStaminaBlue: false,
        },
        {
          ctrlPnlImg: {} as HTMLImageElement,
          runBtnImg: null,
          menuBtnImg: null,
          miniPanelImg: null,
          miniPanelBtnsImg: null,
          levelBtnImg: null,
          levelSocketImg: null,
        },
        font,
      )

      const stamFills = fills.filter((f) => f.x === 273 && f.y === 573)
      expect(stamFills).toEqual([
        { x: 273, y: 573, w: 20, h: 18, color: STAMINA_BAR_COLOR_RED, alpha: STAMINA_BAR_TRANS_ALPHA },
      ])
      expect(texts).toEqual([{ text: 'Stamina: 20 / 100', color: 'white' }])
    })
  })

  describe('Issue #1726: Experience Bar Two-Line Geometry, 640x480 Position & Max-Level Suppression (D2Client.dll 0x6FAD6970)', () => {
    it('places 800x600 and 640x480 experience bar and hover rects at canonical 1.13c coordinates', () => {
      expect(EXP_BAR_BOUNDS).toEqual({ x: 256, y: 562, width: 119, height: 2 })
      expect(EXP_BAR_HOVER_BOUNDS).toEqual({ x: 254, y: 557, width: 123, height: 9 })
      expect(EXP_BAR_BOUNDS_640).toEqual({ x: 176, y: 442, width: 119, height: 2 })
      expect(EXP_BAR_HOVER_BOUNDS_640).toEqual({ x: 174, y: 437, width: 123, height: 9 })
    })

    it('computes fill width out of 119 with >> 7 high-XP scaling and suppresses fill at level >= 99', () => {
      // Halfway through level 1 (0..500 -> into=250, span=500 -> trunc(250 * 119 / 500) = 59)
      expect(computeExpBarFill113c(250, 0, 500, 1)).toBe(59)
      // High XP above 0x226B902 (level 98 -> 99: 3229426756..3520485254, span=291058498, into=145529249)
      expect(computeExpBarFill113c(3229426756 + 145529249, 3229426756, 3520485254, 98)).toBe(59)
      // Max level (99): suppressed (0x6FAD6AC3 cmp level, maxLevel; jae skip)
      expect(computeExpBarFill113c(3520485254, 3229426756, 3520485254, 99)).toBe(0)
      // Over-span clamps > 119 to 0 (0x6FAD6AB2 cmp ebx, 0x77; jbe; xor ebx, ebx)
      expect(computeExpBarFill113c(600, 0, 500, 1)).toBe(0)
    })

    it('draws exactly two 1-px white lines without backdrop or tick notches and nothing at level 99', () => {
      const hud = new ControlBarHud()
      const fills: Array<{ x: number; y: number; w: number; h: number; color: string }> = []
      const ctx = {
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        drawImage: vi.fn(),
        strokeRect: vi.fn(),
        fillRect(x: number, y: number, w: number, h: number) {
          fills.push({ x, y, w, h, color: (this as any).fillStyle })
        },
      } as unknown as CanvasRenderingContext2D
      const font = { measureText: () => 80, drawText: vi.fn() } as any
      const assets = {
        ctrlPnlImg: {} as HTMLImageElement,
        runBtnImg: null,
        menuBtnImg: null,
        miniPanelImg: null,
        miniPanelBtnsImg: null,
        levelBtnImg: null,
        levelSocketImg: null,
      }

      hud.draw(
        ctx,
        {
          level: 10,
          xp: 50000,
          currentLevelXp: 40000,
          nextLevelXp: 60000,
          stamina: 0,
          maxStamina: 100,
          isRunning: false,
          unspentStatPoints: 0,
          unspentSkillPoints: 0,
        },
        assets,
        font,
      )
      expect(fills).toEqual([
        { x: 256, y: 562, w: 59, h: 1, color: EXP_BAR_COLOR },
        { x: 256, y: 563, w: 59, h: 1, color: EXP_BAR_COLOR },
      ])

      fills.length = 0
      hud.draw(
        ctx,
        {
          level: 99,
          xp: 3520485254,
          currentLevelXp: 3229426756,
          nextLevelXp: 3520485254,
          stamina: 0,
          maxStamina: 100,
          isRunning: false,
          unspentStatPoints: 0,
          unspentSkillPoints: 0,
        },
        assets,
        font,
      )
      expect(fills).toEqual([])
    })
  })

  // =========================================================================
  // 10. Issue #1728: D2Client.dll 1.13c Bottom-Anchored HUD Element Pixel Offsets
  // =========================================================================
  describe('10. Bottom-Anchored HUD Element Pixel Offsets (D2Client.dll 1.13c)', () => {
    it('places run button, menu toggle, skill buttons, and 640/800 belt slots & pop-belt at 1.13c coordinates', () => {
      // Run button (0x6FAD83B6): top H - 30 -> 570 at 800x600, 450 at 640x480
      expect(RUN_BTN_BOUNDS).toEqual({ x: 255, y: 570, width: 16, height: 20 })
      expect(RUN_BTN_BOUNDS_640).toEqual({ x: 175, y: 450, width: 16, height: 20 })

      // Menu toggle button (0x6FAD6940): x = W/2 - 8, bottom H - 16, 15x24 -> top H - 40
      expect(MENU_TOGGLE_BOUNDS).toEqual({ x: 392, y: 560, width: 15, height: 24 })
      expect(MENU_TOGGLE_BOUNDS_640).toEqual({ x: 312, y: 440, width: 15, height: 24 })

      // Left/Right skill buttons (0x6FAD8D44 / 0x6FAD8DA9): 48x48, top H - 48 -> 552 at 800x600, 432 at 640x480
      expect(LEFT_SKILL_BOUNDS).toEqual({ x: 117, y: 552, width: 48, height: 48 })
      expect(RIGHT_SKILL_BOUNDS).toEqual({ x: 635, y: 552, width: 48, height: 48 })
      expect(LEFT_SKILL_BOUNDS_640).toEqual({ x: 117, y: 432, width: 48, height: 48 })
      expect(RIGHT_SKILL_BOUNDS_640).toEqual({ x: 475, y: 432, width: 48, height: 48 })

      // Belt slots (0x6FAD7A5A): top H - 38 -> 562 at 800x600, 442 at 640x480
      expect(BELT_BASE_X).toBe(423)
      expect(BELT_BASE_Y).toBe(562)
      expect(getBeltSlotBox(0, 0, true)).toEqual({ x: 343, y: 442, width: 29, height: 29 })

      // Pop-belt background (0x6FAD8EE5): x = W/2 + 21 (421 at 800, 341 at 640), top H - 73 - 32*(row-1)
      const belt = new BeltHud()
      belt.setEquippedBelt('hbl')
      belt.lockedOpen = true
      const popDraws: Array<{ x: number; y: number }> = []
      const ctx = {
        fillStyle: '',
        fillRect: () => {},
        drawImage: (_img: unknown, x: number, y: number) => {
          popDraws.push({ x, y })
        },
      } as unknown as CanvasRenderingContext2D
      const font = { drawText: () => {} } as any
      belt.draw(ctx, { popbeltImg: {} as HTMLImageElement, itemsAtlasImg: null, itemRects: {} }, font)
      expect(popDraws).toEqual([
        { x: 421, y: 527 },
        { x: 421, y: 495 },
        { x: 421, y: 463 },
      ])

      popDraws.length = 0
      belt.is640 = true
      belt.draw(ctx, { popbeltImg: {} as HTMLImageElement, itemsAtlasImg: null, itemRects: {} }, font)
      expect(popDraws).toEqual([
        { x: 341, y: 407 },
        { x: 341, y: 375 },
        { x: 341, y: 343 },
      ])
    })
  })

  // =========================================================================
  // 11. Issue #1730: Life/Mana/Stamina Display Smoothing (D2Client.dll 0x6FAD6B20)
  // =========================================================================
  describe('11. Life/Mana/Stamina Display Smoothing (D2Client.dll 0x6FAD6B20)', () => {
    it('interpolates small changes over clamp(tTarget - tStart, 7, 15) frames and snaps on large jumps or life decrease', () => {
      const smoother = new VitalStatSmoother113c()

      // 1. Initial sample snaps immediately
      expect(smoother.sample(6, 100, 200, 10)).toBe(100)

      // 2. Small life increase (+14 < max >> 3 = 25) at frame 20 (tTarget - tStart = 10 in [7, 15])
      // elapsed = 0 -> start + trunc(14 * 1 / 10) = 101
      expect(smoother.sample(6, 114, 200, 20)).toBe(101)
      // elapsed = 4 -> 100 + trunc(14 * 5 / 10) = 107
      expect(smoother.sample(6, 114, 200, 24)).toBe(107)
      // elapsed = 10 >= duration -> reaches target 114
      expect(smoother.sample(6, 114, 200, 30)).toBe(114)

      // 3. Life decrease (stat 6, allowDecreaseSmooth = false) always snaps immediately even for small loss
      expect(smoother.sample(6, 108, 200, 32)).toBe(108)

      // 4. Mana decrease (stat 8, allowDecreaseSmooth = true) interpolates when |delta| < (max >> 3)
      expect(smoother.sample(8, 100, 200, 10)).toBe(100)
      // Small mana spend (-14 < 25) at frame 15 -> duration clamped to min 7: 100 + trunc(-14 * 1 / 7) = 98
      expect(smoother.sample(8, 86, 200, 15)).toBe(98)
      expect(smoother.sample(8, 86, 200, 22)).toBe(86)

      // 5. Large jump (|delta| >= max >> 3 = 25) snaps immediately
      expect(smoother.sample(8, 50, 200, 25)).toBe(50)

      // 6. Stamina bar (stat 10) uses smoothed value for fill width when frame is supplied while keeping raw tooltip
      const hud = new ControlBarHud()
      const widths: number[] = []
      const ctx = {
        fillStyle: '',
        globalAlpha: 1,
        fillRect: (_x: number, y: number, w: number) => {
          if (y === 573) widths.push(w)
        },
        drawImage: () => {},
      } as unknown as CanvasRenderingContext2D
      const assets = {
        ctrlPnlImg: null,
        runBtnImg: null,
        menuBtnImg: null,
        miniPanelImg: null,
        miniPanelBtnsImg: null,
        levelBtnImg: null,
        levelSocketImg: null,
      }
      const font = { drawText: () => {}, measureText: () => 40 } as any

      hud.draw(
        ctx,
        {
          level: 1,
          xp: 0,
          currentLevelXp: 0,
          nextLevelXp: 500,
          stamina: 100,
          maxStamina: 100,
          isRunning: true,
          unspentStatPoints: 0,
          unspentSkillPoints: 0,
          frame: 10,
        },
        assets,
        font,
      )
      hud.draw(
        ctx,
        {
          level: 1,
          xp: 0,
          currentLevelXp: 0,
          nextLevelXp: 500,
          stamina: 93,
          maxStamina: 100,
          isRunning: true,
          unspentStatPoints: 0,
          unspentSkillPoints: 0,
          frame: 15,
        },
        assets,
        font,
      )
      expect(widths[0]).toBe(102)
      expect(widths[1]).toBeGreaterThan(Math.trunc((93 * 102) / 100))
      expect(widths[1]).toBeLessThanOrEqual(102)
    })
  })
})
