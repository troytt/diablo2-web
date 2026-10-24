/**
 * Diablo II v1.13c 800x600 Bottom Control Panel (`Panel\800CtrlPnl7.dc6`).
 *
 * Houses:
 * - Experience Bar (x=256, y=560, w=120, h=4) with tick notches & hover readout
 * - Stamina Bar (x=273, y=573, w=102, h=18) with run drain & walk/stand recovery
 * - Walk / Run Toggle Button (`Panel\runbutton.dc6` at x=255, y=572, w=16, h=20, hotkey `R`)
 * - Central Mini-Panel Toggle (`Panel\menubutton.dc6` at x=393, y=562, w=15, h=24) &
 *   Mini-Panel Popup (`Panel\minipanel.dc6` 8-button 176x26 at x=312, y=522 in multiplayer,
 *   or `Panel\minipanel_s.dc6` 7-button 156x26 at x=322, y=522 in single-player):
 *   [Character, Inventory, Skill Tree, Party Screen (mp only), Automap, Message Log, Quest Log, Game Menu (Esc)]
 * - Unallocated Stat Points & Skill Points Buttons (`Panel\Level.dc6` 3 frames of 30x30:
 *   0=red lit, 1=red pressed, 2=gray raised; always visible in the sockets baked into
 *   the control panel background — gray while idle, steady red while points are
 *   unspent, pressed cell while held down)
 *
 * All bar buttons follow the 1.13c mouse driver: mouse-down only latches the pressed
 * cell, the action fires on mouse-up inside the same button — dragging off the button
 * and releasing cancels it (`LevelPlusButton` in `level-button.ts`).
 */

import type { D2FontRenderer } from './font.ts'
import type { TblLang } from '../i18n/lang.ts'
import { resolveTblKey } from '../../common/data/canonical-tbl-strings.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import { LevelPlusButton, LEVEL_BTN_CELL_SIZE } from './level-button.ts'

export type MiniPanelAction =
  | 'char'
  | 'inv'
  | 'skill'
  | 'party'
  | 'automap'
  | 'msg'
  | 'quest'
  | 'menu'

export interface ControlBarState {
  readonly level: number
  readonly xp: number
  readonly currentLevelXp: number
  readonly nextLevelXp: number
  readonly stamina: number
  readonly maxStamina: number
  readonly isRunning: boolean
  readonly unspentStatPoints: number
  readonly unspentSkillPoints: number
  readonly isStaminaBlue?: boolean
}

export const EXP_BAR_BOUNDS = { x: 256, y: 560, width: 120, height: 4 } as const
export const EXP_BAR_HOVER_BOUNDS = { x: 256, y: 558, width: 120, height: 8 } as const
export const STAMINA_BAR_BOUNDS = { x: 273, y: 573, width: 102, height: 18 } as const
export const RUN_BTN_BOUNDS = { x: 255, y: 572, width: 16, height: 20 } as const
export const MENU_TOGGLE_BOUNDS = { x: 393, y: 562, width: 15, height: 24 } as const
export const MINIPANEL_BOUNDS = { x: 312, y: 522, width: 176, height: 26 } as const
export const MINIPANEL_SINGLE_BOUNDS = { x: 322, y: 522, width: 156, height: 26 } as const
// `Level.dc6` button positions sit exactly on the 30x30 inner recess of the socket
// squares baked into `800CtrlPnl7.dc6` (socket outer gold border x 205..236 / 562..593,
// y 65..96 panel space, panel drawn at y=496).
export const STAT_PLUS_BTN_BOUNDS = { x: 206, y: 562, width: 30, height: 30 } as const
export const SKILL_PLUS_BTN_BOUNDS = { x: 563, y: 562, width: 30, height: 30 } as const

export const EXP_BAR_BOUNDS_640 = { x: 192, y: 431, width: 120, height: 4 } as const
export const EXP_BAR_HOVER_BOUNDS_640 = { x: 192, y: 429, width: 120, height: 8 } as const
export const STAMINA_BAR_BOUNDS_640 = { x: 193, y: 453, width: 102, height: 18 } as const
export const RUN_BTN_BOUNDS_640 = { x: 175, y: 450, width: 16, height: 20 } as const
export const MENU_TOGGLE_BOUNDS_640 = { x: 312, y: 441, width: 15, height: 24 } as const
export const MINIPANEL_BOUNDS_640 = { x: 236, y: 411, width: 176, height: 26 } as const
export const MINIPANEL_SINGLE_BOUNDS_640 = { x: 246, y: 411, width: 156, height: 26 } as const
export const STAT_PLUS_BTN_BOUNDS_640 = { x: 126, y: 442, width: 30, height: 30 } as const
export const SKILL_PLUS_BTN_BOUNDS_640 = { x: 483, y: 442, width: 30, height: 30 } as const

export interface MiniPanelItemDef {
  readonly action: MiniPanelAction
  readonly iconGroup: number
  readonly tblKey: string
  readonly hotkey?: string
  readonly fallbackEn: string
  readonly fallbackZh: string
}

export const MULTIPLAYER_MINIPANEL_ITEMS: readonly MiniPanelItemDef[] = [
  { action: 'char', iconGroup: 0, tblKey: 'minipanelchar', hotkey: 'A', fallbackEn: 'Character', fallbackZh: '人物' },
  { action: 'inv', iconGroup: 1, tblKey: 'minipanelinv', hotkey: 'I', fallbackEn: 'Inventory', fallbackZh: '物品' },
  { action: 'skill', iconGroup: 2, tblKey: 'minipaneltree', hotkey: 'T', fallbackEn: 'Skill Tree', fallbackZh: '技能樹' },
  { action: 'party', iconGroup: 3, tblKey: 'minipanelparty', hotkey: 'P', fallbackEn: 'Party Screen', fallbackZh: '隊伍畫面' },
  { action: 'automap', iconGroup: 4, tblKey: 'minipanelautomap', hotkey: 'Tab', fallbackEn: 'Automap', fallbackZh: '自動地圖' },
  { action: 'msg', iconGroup: 5, tblKey: 'minipanelmessage', hotkey: 'M', fallbackEn: 'Message Log', fallbackZh: '訊息記錄' },
  { action: 'quest', iconGroup: 6, tblKey: 'minipanelquest', hotkey: 'Q', fallbackEn: 'Quest Log', fallbackZh: '任務記錄' },
  { action: 'menu', iconGroup: 7, tblKey: 'minipanelmenubtn', fallbackEn: 'Game Menu (Esc)', fallbackZh: '遊戲選單（Esc）' },
]

export const SINGLEPLAYER_MINIPANEL_ITEMS: readonly MiniPanelItemDef[] = [
  { action: 'char', iconGroup: 0, tblKey: 'minipanelchar', hotkey: 'A', fallbackEn: 'Character', fallbackZh: '人物' },
  { action: 'inv', iconGroup: 1, tblKey: 'minipanelinv', hotkey: 'I', fallbackEn: 'Inventory', fallbackZh: '物品' },
  { action: 'skill', iconGroup: 2, tblKey: 'minipaneltree', hotkey: 'T', fallbackEn: 'Skill Tree', fallbackZh: '技能樹' },
  { action: 'automap', iconGroup: 4, tblKey: 'minipanelautomap', hotkey: 'Tab', fallbackEn: 'Automap', fallbackZh: '自動地圖' },
  { action: 'msg', iconGroup: 5, tblKey: 'minipanelmessage', hotkey: 'M', fallbackEn: 'Message Log', fallbackZh: '訊息記錄' },
  { action: 'quest', iconGroup: 6, tblKey: 'minipanelquest', hotkey: 'Q', fallbackEn: 'Quest Log', fallbackZh: '任務記錄' },
  { action: 'menu', iconGroup: 7, tblKey: 'minipanelmenubtn', fallbackEn: 'Game Menu (Esc)', fallbackZh: '遊戲選單（Esc）' },
]

export function getMiniPanelTooltip(item: MiniPanelItemDef, lang: TblLang): string {
  const base = resolveTblKey(item.tblKey, lang) ?? (lang === 'ENG' ? item.fallbackEn : item.fallbackZh)
  if (!item.hotkey) {
    return base
  }
  const specialFmt = resolveTblKey('minipanelspecial', lang) ?? (lang === 'ENG' ? ' (%s)' : '（%s）')
  return base + specialFmt.replace('%s', item.hotkey)
}

/**
 * `Panel/Level.dc6` `+` button semantics live in `level-button.ts` (`LevelPlusButton`);
 * re-exported here for the existing parity-test imports.
 */
export { levelButtonFrame } from './level-button.ts'

export class ControlBarHud {
  miniPanelOpen = true
  lang: TblLang = 'CHI'
  isMultiplayer = true
  is640 = false
  pressedAction: MiniPanelAction | null = null
  /** Run/walk toggle latched on mouse-down; fires on mouse-up inside the button. */
  pressedRun = false
  /** Mini-panel show/hide chevron latched on mouse-down; fires on mouse-up inside the button. */
  pressedMenuToggle = false
  hoveredElement: 'exp' | 'stamina' | 'run' | 'menuToggle' | 'statPlus' | 'skillPlus' | MiniPanelAction | null = null
  readonly statPlusButton = new LevelPlusButton('stat', () => this.statPlusBtnBounds)
  readonly skillPlusButton = new LevelPlusButton('skill', () => this.skillPlusBtnBounds)

  get pressedPlus(): 'stat' | 'skill' | null {
    if (this.statPlusButton.isPressed) return 'stat'
    if (this.skillPlusButton.isPressed) return 'skill'
    return null
  }

  get expBarBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? EXP_BAR_BOUNDS_640 : EXP_BAR_BOUNDS
  }

  get expBarHoverBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? EXP_BAR_HOVER_BOUNDS_640 : EXP_BAR_HOVER_BOUNDS
  }

  get staminaBarBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? STAMINA_BAR_BOUNDS_640 : STAMINA_BAR_BOUNDS
  }

  get runBtnBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? RUN_BTN_BOUNDS_640 : RUN_BTN_BOUNDS
  }

  get menuToggleBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? MENU_TOGGLE_BOUNDS_640 : MENU_TOGGLE_BOUNDS
  }

  get statPlusBtnBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? STAT_PLUS_BTN_BOUNDS_640 : STAT_PLUS_BTN_BOUNDS
  }

  get skillPlusBtnBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? SKILL_PLUS_BTN_BOUNDS_640 : SKILL_PLUS_BTN_BOUNDS
  }

  get currentMiniPanelItems(): readonly MiniPanelItemDef[] {
    return this.isMultiplayer ? MULTIPLAYER_MINIPANEL_ITEMS : SINGLEPLAYER_MINIPANEL_ITEMS
  }

  get currentMiniPanelBounds(): { x: number; y: number; width: number; height: number } {
    if (this.is640) {
      return this.isMultiplayer ? MINIPANEL_BOUNDS_640 : MINIPANEL_SINGLE_BOUNDS_640
    }
    return this.isMultiplayer ? MINIPANEL_BOUNDS : MINIPANEL_SINGLE_BOUNDS
  }

  get currentButtonStartX(): number {
    return this.currentMiniPanelBounds.x + 8
  }

  get currentButtonStartY(): number {
    return this.currentMiniPanelBounds.y + 3
  }

  handleMouseMove(
    logicalX: number,
    logicalY: number,
    points?: { unspentStatPoints: number; unspentSkillPoints: number },
  ): void {
    this.hoveredElement = null

    if (this.miniPanelOpen) {
      const items = this.currentMiniPanelItems
      const startX = this.currentButtonStartX
      const startY = this.currentButtonStartY
      const relX = logicalX - startX
      const relY = logicalY - startY
      if (relY >= 0 && relY < 20 && relX >= 0) {
        const idx = Math.floor(relX / 20)
        if (idx >= 0 && idx < items.length) {
          this.hoveredElement = items[idx]!.action
          return
        }
      }
    }
    if (this.inRect(logicalX, logicalY, this.expBarHoverBounds)) {
      this.hoveredElement = 'exp'
    } else if (this.inRect(logicalX, logicalY, this.staminaBarBounds)) {
      this.hoveredElement = 'stamina'
    } else if (this.inRect(logicalX, logicalY, this.runBtnBounds)) {
      this.hoveredElement = 'run'
    } else if (this.inRect(logicalX, logicalY, this.menuToggleBounds)) {
      this.hoveredElement = 'menuToggle'
    } else if (this.inRect(logicalX, logicalY, this.statPlusBtnBounds)) {
      // The idle gray buttons show no tooltip in 1.13c — only lit buttons advertise points.
      if (!points || points.unspentStatPoints > 0) this.hoveredElement = 'statPlus'
    } else if (this.inRect(logicalX, logicalY, this.skillPlusBtnBounds)) {
      if (!points || points.unspentSkillPoints > 0) this.hoveredElement = 'skillPlus'
    }
  }

  handleMouseDown(
    logicalX: number,
    logicalY: number,
    points?: { unspentStatPoints: number; unspentSkillPoints: number },
  ): void {
    // 1.13c button semantics: mouse-down only latches the pressed cell; the action
    // fires in handleMouseUp and only when the release lands back on the button.
    this.pressedAction = this.miniPanelOpen ? this.miniPanelActionAt(logicalX, logicalY) : null
    this.pressedRun = this.inRect(logicalX, logicalY, this.runBtnBounds)
    this.pressedMenuToggle = this.inRect(logicalX, logicalY, this.menuToggleBounds)
    this.statPlusButton.press(logicalX, logicalY, !points || points.unspentStatPoints > 0)
    this.skillPlusButton.press(logicalX, logicalY, !points || points.unspentSkillPoints > 0)
  }

  handleMouseUp(
    logicalX: number,
    logicalY: number,
    callbacks: {
      onToggleRun: () => void
      onMiniPanelAction: (action: MiniPanelAction) => void
    },
  ): boolean {
    let fired = false
    if (this.pressedAction !== null && this.pressedAction === this.miniPanelActionAt(logicalX, logicalY)) {
      callbacks.onMiniPanelAction(this.pressedAction)
      fired = true
    }
    this.pressedAction = null
    if (this.pressedRun && this.inRect(logicalX, logicalY, this.runBtnBounds)) {
      callbacks.onToggleRun()
      fired = true
    }
    this.pressedRun = false
    if (this.pressedMenuToggle && this.inRect(logicalX, logicalY, this.menuToggleBounds)) {
      this.miniPanelOpen = !this.miniPanelOpen
      fired = true
    }
    this.pressedMenuToggle = false
    if (this.statPlusButton.release(logicalX, logicalY)) {
      callbacks.onMiniPanelAction('char')
      fired = true
    }
    if (this.skillPlusButton.release(logicalX, logicalY)) {
      callbacks.onMiniPanelAction('skill')
      fired = true
    }
    return fired
  }

  /** Mini-panel cell under the point, or `null` when the popup is closed / the point misses it. */
  private miniPanelActionAt(logicalX: number, logicalY: number): MiniPanelAction | null {
    if (!this.miniPanelOpen) return null
    const items = this.currentMiniPanelItems
    const relX = logicalX - this.currentButtonStartX
    const relY = logicalY - this.currentButtonStartY
    if (relY >= 0 && relY < 20 && relX >= 0) {
      const idx = Math.floor(relX / 20)
      if (idx >= 0 && idx < items.length) return items[idx]!.action
    }
    return null
  }

  /**
   * Whether the point sits on any interactive control-bar element (mini-panel cell,
   * menu/run toggle or a `+` socket). Used by the mouse-down router to consume presses
   * over the bar without triggering anything.
   */
  isInteractiveHit(logicalX: number, logicalY: number): boolean {
    if (this.miniPanelActionAt(logicalX, logicalY) !== null) return true
    return (
      this.inRect(logicalX, logicalY, this.menuToggleBounds) ||
      this.inRect(logicalX, logicalY, this.runBtnBounds) ||
      this.inRect(logicalX, logicalY, this.statPlusBtnBounds) ||
      this.inRect(logicalX, logicalY, this.skillPlusBtnBounds)
    )
  }

  private inRect(x: number, y: number, r: { x: number; y: number; width: number; height: number }): boolean {
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: ControlBarState,
    assets: {
      ctrlPnlImg: HTMLImageElement | null
      runBtnImg: HTMLImageElement | null
      menuBtnImg: HTMLImageElement | null
      miniPanelImg: HTMLImageElement | null
      miniPanelBtnsImg: HTMLImageElement | null
      levelBtnImg: HTMLImageElement | null
      levelSocketImg: HTMLImageElement | null
    },
    font: D2FontRenderer,
  ): void {
    const expBounds = this.expBarBounds
    const stamBounds = this.staminaBarBounds
    const runBounds = this.runBtnBounds
    const menuBounds = this.menuToggleBounds
    const statPlusBounds = this.statPlusBtnBounds
    const skillPlusBounds = this.skillPlusBtnBounds
    const ctrlPanelY = this.is640 ? 376 : 496

    // 1. Draw stitched stone control panel (`800CtrlPnl7.dc6` at y=496..600 or `CtrlPnl7.dc6` at y=376..480)
    if (assets.ctrlPnlImg) {
      ctx.drawImage(assets.ctrlPnlImg, 0, ctrlPanelY)
    } else {
      reportMissingArt('ui-control-bar', this.is640 ? 'CtrlPnl7' : '800CtrlPnl7', 'Missing control panel art')
    }

    // 2. Experience Bar
    const xpSpan = Math.max(1, state.nextLevelXp - state.currentLevelXp)
    const xpRatio = Math.max(0, Math.min(1, (state.xp - state.currentLevelXp) / xpSpan))
    ctx.fillStyle = '#070605'
    ctx.fillRect(expBounds.x, expBounds.y, expBounds.width, expBounds.height)
    ctx.fillStyle = '#d8d0a8'
    ctx.fillRect(expBounds.x, expBounds.y, Math.round(expBounds.width * xpRatio), expBounds.height)

    // Tick notches (10 segments, 12px each)
    ctx.fillStyle = '#1e1812'
    for (let i = 1; i < 10; i++) {
      ctx.fillRect(expBounds.x + i * 12, expBounds.y, 1, expBounds.height)
    }

    // 3. Stamina Bar
    const stamRatio = Math.max(0, Math.min(1, state.stamina / Math.max(1, state.maxStamina)))
    ctx.fillStyle = '#090705'
    ctx.fillRect(stamBounds.x, stamBounds.y, stamBounds.width, stamBounds.height)
    ctx.fillStyle = state.isStaminaBlue ? '#2858d8' : '#c88414'
    ctx.fillRect(
      stamBounds.x,
      stamBounds.y,
      Math.round(stamBounds.width * stamRatio),
      stamBounds.height,
    )

    // 4. Run / Walk Toggle Button (`runbutton.dc6`, 4 frames of 16x20: 0=walk, 2=run)
    if (assets.runBtnImg) {
      const frameIdx = state.isRunning ? 2 : 0
      ctx.drawImage(assets.runBtnImg, frameIdx * 16, 0, 16, 20, runBounds.x, runBounds.y, 16, 20)
    }

    // 5. Central Mini-panel Toggle Triangle (`menubutton.dc6`, 4 frames of 15x24)
    if (assets.menuBtnImg) {
      const frameIdx = this.miniPanelOpen ? 2 : 0
      ctx.drawImage(assets.menuBtnImg, frameIdx * 15, 0, 15, 24, menuBounds.x, menuBounds.y, 15, 24)
    }

    // 6. Central Mini-panel Popup (`minipanel.dc6` 176x26 / `minipanel_s.dc6` 156x26 + `minipanelbtn.dc6` 20x20 icons)
    if (this.miniPanelOpen) {
      const bounds = this.currentMiniPanelBounds
      const items = this.currentMiniPanelItems
      const startX = this.currentButtonStartX
      const by = this.currentButtonStartY

      if (assets.miniPanelImg) {
        ctx.drawImage(assets.miniPanelImg, bounds.x, bounds.y)
      } else {
        reportMissingArt('ui-control-bar', 'minipanel', 'Missing mini panel background art')
      }
      for (let i = 0; i < items.length; i++) {
        const bx = startX + i * 20
        const item = items[i]!
        const isPressed = this.pressedAction === item.action
        if (assets.miniPanelBtnsImg) {
          const frameIdx = item.iconGroup * 2 + (isPressed ? 1 : 0)
          ctx.drawImage(assets.miniPanelBtnsImg, frameIdx * 20, 0, 20, 20, bx, by, 20, 20)
        }
      }
    }

    // 7. Unallocated Stat Points (`+`) & Skill Points (`+`) Buttons (`Panel/Level.dc6`)
    // The socket squares are baked into the control panel background, so only the
    // 30x30 button cell is drawn here: static gray raised frame 2 with no unspent
    // points, steady lit red frame 0 while points are available, and the pressed
    // cell 1 while the button itself is held down.
    if (assets.levelBtnImg) {
      const statFrame = this.statPlusButton.frame(state.unspentStatPoints)
      ctx.drawImage(
        assets.levelBtnImg,
        statFrame * LEVEL_BTN_CELL_SIZE,
        0,
        LEVEL_BTN_CELL_SIZE,
        LEVEL_BTN_CELL_SIZE,
        statPlusBounds.x,
        statPlusBounds.y,
        LEVEL_BTN_CELL_SIZE,
        LEVEL_BTN_CELL_SIZE,
      )
      const skillFrame = this.skillPlusButton.frame(state.unspentSkillPoints)
      ctx.drawImage(
        assets.levelBtnImg,
        skillFrame * LEVEL_BTN_CELL_SIZE,
        0,
        LEVEL_BTN_CELL_SIZE,
        LEVEL_BTN_CELL_SIZE,
        skillPlusBounds.x,
        skillPlusBounds.y,
        LEVEL_BTN_CELL_SIZE,
        LEVEL_BTN_CELL_SIZE,
      )
    }

    // 8. Hover Tooltip over Experience / Stamina / Mini-panel buttons
    const isEn = this.lang === 'ENG'
    const tipY = this.is640 ? 398 : 518
    const miniTipY = this.is640 ? 382 : 502
    const miniTipCx = this.is640 ? 320 : 400
    if (this.hoveredElement === 'exp') {
      const tmpl = resolveTblKey('panelexp', this.lang) ?? (isEn ? 'Experience: %u / %u' : '經驗： %u / %u')
      const text = tmpl
        .replace(/%[du]/, String(state.xp))
        .replace(/%[du]/, String(state.nextLevelXp))
      this.drawMiniTooltip(ctx, font, text, expBounds.x + 60, tipY)
    } else if (this.hoveredElement === 'stamina') {
      const tmpl = resolveTblKey('panelstamina', this.lang) ?? (isEn ? 'Stamina: %d / %d' : '耐力： %d / %d')
      const text = tmpl
        .replace(/%[du]/, String(Math.round(state.stamina)))
        .replace(/%[du]/, String(Math.round(state.maxStamina)))
      this.drawMiniTooltip(ctx, font, text, stamBounds.x + 51, tipY)
    } else if (this.hoveredElement === 'run') {
      const text = state.isRunning
        ? (resolveTblKey('RunOn', this.lang) ?? (isEn ? 'Run' : '跑步'))
        : (resolveTblKey('RunOff', this.lang) ?? (isEn ? 'Walk' : '行走'))
      this.drawMiniTooltip(ctx, font, text, runBounds.x + 8, tipY)
    } else if (this.hoveredElement === 'statPlus') {
      const text = resolveTblKey('strlvlup', this.lang) ?? (isEn ? 'New Stats' : '新人物狀況')
      this.drawMiniTooltip(ctx, font, text, statPlusBounds.x + 15, tipY)
    } else if (this.hoveredElement === 'skillPlus') {
      const text = resolveTblKey('strnewskl', this.lang) ?? (isEn ? 'New Skill' : '新技能')
      this.drawMiniTooltip(ctx, font, text, skillPlusBounds.x + 15, tipY)
    } else if (this.hoveredElement === 'menuToggle') {
      const tip = this.miniPanelOpen
        ? (resolveTblKey('panelcmini', this.lang) ?? (isEn ? 'Close Mini Panel' : '關閉迷你面板'))
        : (resolveTblKey('panelmini', this.lang) ?? (isEn ? 'Open Mini Panel' : '開啟迷你面板'))
      this.drawMiniTooltip(ctx, font, tip, menuBounds.x + 8, tipY)
    } else if (this.hoveredElement) {
      const items = this.currentMiniPanelItems
      const found = items.find((m) => m.action === this.hoveredElement)
      if (found) {
        const tip = getMiniPanelTooltip(found, this.lang)
        this.drawMiniTooltip(ctx, font, tip, miniTipCx, miniTipY)
      }
    }
  }

  private drawMiniTooltip(ctx: CanvasRenderingContext2D, font: D2FontRenderer, text: string, cx: number, y: number): void {
    const maxW = this.is640 ? 640 : 800
    const w = Math.max(120, font.measureText(text, 'fontexocet10') + 20)
    const x = Math.max(8, Math.min(maxW - w - 8, Math.round(cx - w / 2)))
    ctx.fillStyle = 'rgba(6, 6, 6, 0.92)'
    ctx.fillRect(x, y, w, 24)
    ctx.strokeStyle = '#8c7244'
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 23)
    font.drawText(ctx, text, x + Math.round(w / 2), y + 17, {
      font: 'fontexocet10',
      color: 'gold',
      align: 'center',
    })
  }
}
