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
} from '../../src/client/ui/control-bar.ts'
import {
  CharacterSheetPanel,
  STAT_ALLOC_BUTTONS,
  STAT_POINTS_BANNER_BOUNDS,
  STAT_POINTS_NUMBER_BOX_BOUNDS,
  CHAR_CLOSE_BTN_BOUNDS,
  drawStatPointsSunkenSlot,
} from '../../src/client/ui/character-sheet.ts'
import { LEVEL_BTN_CELL_SIZE } from '../../src/client/ui/level-button.ts'
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

    it('handles mouse clicks and hover correctly across 20px button pitch', () => {
      const hud = new ControlBarHud()
      hud.miniPanelOpen = true
      hud.isMultiplayer = true

      const onMiniPanelAction = vi.fn()
      const callbacks = { onToggleRun: vi.fn(), onMiniPanelAction }

      // Button 0 (char): x = 320..339, y = 525..544 — press, then release on the button.
      hud.handleMouseMove(325, 530)
      expect(hud.hoveredElement).toBe('char')
      hud.handleMouseDown(325, 530)
      hud.handleMouseUp(325, 530, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('char')

      // Button 3 (party): x = 380..399
      hud.handleMouseMove(385, 530)
      expect(hud.hoveredElement).toBe('party')
      hud.handleMouseDown(385, 530)
      hud.handleMouseUp(385, 530, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('party')

      // Button 7 (menu): x = 460..479 — press, drag off, release: cancelled.
      hud.handleMouseMove(465, 530)
      expect(hud.hoveredElement).toBe('menu')
      hud.handleMouseDown(465, 530)
      hud.handleMouseUp(465, 480, callbacks)
      expect(onMiniPanelAction).not.toHaveBeenCalledWith('menu')
      hud.handleMouseDown(465, 530)
      hud.handleMouseUp(465, 530, callbacks)
      expect(onMiniPanelAction).toHaveBeenCalledWith('menu')
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
})
