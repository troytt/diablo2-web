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

import type { D2ColorCode, D2FontRenderer } from './font.ts'
import type { TblLang } from '../i18n/lang.ts'
import { resolveTblKey } from '../../common/data/canonical-tbl-strings.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import { LevelPlusButton, LEVEL_BTN_CELL_SIZE } from './level-button.ts'
import { VitalStatSmoother113c } from './globes.ts'

/**
 * D2Client.dll `0x6FAD78DD..0x6FAD7918`: Stamina bar palette RGB targets resolved via `D2Gfx_FindBestColor` (`#10035`)
 * and `0x6FAD794E..0x6FAD797D` low-stamina width threshold (`w < 25` -> red) & translucent rect mode (`transMode = 2`).
 */
export const STAMINA_BAR_COLOR_RED = '#ff0000'
export const STAMINA_BAR_COLOR_YELLOW = '#f4c04c'
export const STAMINA_BAR_COLOR_BLUE = '#0000ff'
export const STAMINA_BAR_LOW_WIDTH_THRESHOLD = 25
export const STAMINA_BAR_TRANS_ALPHA = 0.75

export function computeStaminaBarVisual113c(
  stamina: number,
  maxStamina: number,
  isStaminaBlue = false,
  barWidth = 102,
  displayStamina = stamina,
): { width: number; color: string; tooltipCur: number; tooltipMax: number; tooltipColor: D2ColorCode } {
  const isBlueDraw = Boolean(isStaminaBlue) || displayStamina > maxStamina + 5
  const effectiveMax = isBlueDraw ? displayStamina : maxStamina
  let width = 0
  if (effectiveMax > 0) {
    width = Math.min(barWidth, Math.max(0, Math.trunc((displayStamina * barWidth) / effectiveMax)))
  }
  let color = isBlueDraw ? STAMINA_BAR_COLOR_BLUE : STAMINA_BAR_COLOR_YELLOW
  if (!isBlueDraw && (effectiveMax <= 0 || width < STAMINA_BAR_LOW_WIDTH_THRESHOLD)) {
    color = STAMINA_BAR_COLOR_RED
  }
  const curInt = Math.floor(stamina)
  const maxInt = Math.floor(maxStamina)
  const isBlueTip = Boolean(isStaminaBlue) || curInt > maxInt
  return {
    width,
    color,
    tooltipCur: isBlueTip ? maxInt : curInt,
    tooltipMax: maxInt,
    tooltipColor: isBlueTip ? 'blue' : 'white',
  }
}

export const EXP_BAR_COLOR = '#ffffff'
export const EXP_BAR_MAX_LEVEL = 99
export const EXP_BAR_SHIFT_THRESHOLD = 0x226b902

/**
 * D2Client.dll `0x6FAD6970..0x6FAD6B13` (`sub_6FAD6970`): Experience bar fill width (`0..119`).
 * Shifts `into` and `span` right by 7 when `into >= 0x226B902` (`36,092,162`), clamps `fill > 119 -> 0`,
 * and suppresses drawing when `level >= maxLevel` (`99`) or `fill <= 0`.
 */
export function computeExpBarFill113c(
  xp: number,
  currentLevelXp: number,
  nextLevelXp: number,
  level: number,
  maxLevel = EXP_BAR_MAX_LEVEL,
  barWidth = 119,
): number {
  if (level >= maxLevel) return 0
  let span = nextLevelXp > currentLevelXp ? Math.trunc(nextLevelXp - currentLevelXp) : 0
  if (span <= 0) return 0
  let into = xp > currentLevelXp ? Math.trunc(xp - currentLevelXp) : 0
  if (into >= EXP_BAR_SHIFT_THRESHOLD) {
    into = into >>> 7
    span = span >>> 7
  }
  if (span <= 0) return 0
  const fill = Math.trunc((into * barWidth) / span)
  if (fill <= 0 || fill > barWidth) return 0
  return fill
}

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
  readonly frame?: number
}

export type MiniPanelPlacementMode = 0 | 1 | 2 | 3

export const MINIPANEL_BUTTON_PITCH = 21
export const MINIPANEL_BUTTON_SIZE = 20
export const EXP_BAR_BOUNDS = { x: 256, y: 562, width: 119, height: 2 } as const
export const EXP_BAR_HOVER_BOUNDS = { x: 254, y: 557, width: 123, height: 9 } as const
export const STAMINA_BAR_BOUNDS = { x: 273, y: 573, width: 102, height: 18 } as const
export const RUN_BTN_BOUNDS = { x: 255, y: 570, width: 16, height: 20 } as const
export const MENU_TOGGLE_BOUNDS = { x: 392, y: 560, width: 15, height: 24 } as const
export const MINIPANEL_BOUNDS = { x: 313, y: 527, width: 173, height: 26 } as const
export const MINIPANEL_SINGLE_BOUNDS = { x: 323, y: 527, width: 152, height: 26 } as const
// `Level.dc6` button positions sit exactly on the 30x30 inner recess of the socket
// squares baked into `800CtrlPnl7.dc6` (socket outer gold border x 205..236 / 562..593,
// y 65..96 panel space, panel drawn at y=496).
export const STAT_PLUS_BTN_BOUNDS = { x: 206, y: 562, width: 30, height: 30 } as const
export const SKILL_PLUS_BTN_BOUNDS = { x: 563, y: 562, width: 30, height: 30 } as const

export const EXP_BAR_BOUNDS_640 = { x: 176, y: 442, width: 119, height: 2 } as const
export const EXP_BAR_HOVER_BOUNDS_640 = { x: 174, y: 437, width: 123, height: 9 } as const
export const STAMINA_BAR_BOUNDS_640 = { x: 193, y: 453, width: 102, height: 18 } as const
export const RUN_BTN_BOUNDS_640 = { x: 175, y: 450, width: 16, height: 20 } as const
export const MENU_TOGGLE_BOUNDS_640 = { x: 312, y: 440, width: 15, height: 24 } as const
export const MINIPANEL_BOUNDS_640 = { x: 233, y: 407, width: 173, height: 26 } as const
export const MINIPANEL_SINGLE_BOUNDS_640 = { x: 243, y: 407, width: 152, height: 26 } as const
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
  leftPanelOpen = false
  rightPanelOpen = false
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
  smoother = new VitalStatSmoother113c()

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

  /**
   * D2Client.dll 0x6FB14990 placement mode from 0x6FB13880 (left panel) & 0x6FB137B0 (right panel):
   * - 0: both side panels open -> hidden (`0x6FBCC090 = 1`)
   * - 1: right panel only -> shifted left
   * - 2: neither open -> centered
   * - 3: left panel only -> shifted right
   */
  get miniPanelPlacementMode(): MiniPanelPlacementMode {
    if (this.leftPanelOpen && this.rightPanelOpen) return 0
    if (this.rightPanelOpen) return 1
    if (this.leftPanelOpen) return 3
    return 2
  }

  get isMiniPanelVisible(): boolean {
    return this.miniPanelOpen && this.miniPanelPlacementMode !== 0
  }

  get currentMiniPanelItems(): readonly MiniPanelItemDef[] {
    return this.isMultiplayer ? MULTIPLAYER_MINIPANEL_ITEMS : SINGLEPLAYER_MINIPANEL_ITEMS
  }

  get currentMiniPanelBounds(): { x: number; y: number; width: number; height: number } {
    const halfW = this.is640 ? 320 : 400
    const screenH = this.is640 ? 480 : 600
    const width = this.isMultiplayer ? 173 : 152
    const height = 26
    const y = screenH - 73
    const mode = this.miniPanelPlacementMode
    let x: number
    if (mode === 1) {
      x = halfW - 205
    } else if (mode === 3) {
      x = this.isMultiplayer ? halfW + 33 : halfW + 54
    } else {
      x = this.isMultiplayer ? halfW - 87 : halfW - 77
    }
    return { x, y, width, height }
  }

  get currentButtonStartX(): number {
    const halfW = this.is640 ? 320 : 400
    const mode = this.miniPanelPlacementMode
    if (mode === 1) return halfW - 202
    if (mode === 3) return this.isMultiplayer ? halfW + 35 : halfW + 57
    return this.isMultiplayer ? halfW - 84 : halfW - 74
  }

  get currentButtonStartY(): number {
    const screenH = this.is640 ? 480 : 600
    return screenH - 70
  }

  handleMouseMove(
    logicalX: number,
    logicalY: number,
    points?: { unspentStatPoints: number; unspentSkillPoints: number },
  ): void {
    this.hoveredElement = null

    const mpAction = this.miniPanelActionAt(logicalX, logicalY)
    if (mpAction !== null) {
      this.hoveredElement = mpAction
      return
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
    this.pressedAction = this.isMiniPanelVisible ? this.miniPanelActionAt(logicalX, logicalY) : null
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

  /**
   * Mini-panel cell under the point per D2Client.dll 0x6FB13000 (21-px pitch, top H-70)
   * and 0x6FB14550 (20-px button width, H-70 <= y < H-47), or `null` when hidden/missed.
   */
  private miniPanelActionAt(logicalX: number, logicalY: number): MiniPanelAction | null {
    if (!this.isMiniPanelVisible) return null
    const items = this.currentMiniPanelItems
    const screenH = this.is640 ? 480 : 600
    const startY = this.currentButtonStartY
    if (logicalY < startY || logicalY >= screenH - 47) return null
    const relX = logicalX - this.currentButtonStartX
    if (relX < 0) return null
    const idx = Math.floor(relX / MINIPANEL_BUTTON_PITCH)
    const offsetInSlot = relX - idx * MINIPANEL_BUTTON_PITCH
    if (idx >= 0 && idx < items.length && offsetInSlot < MINIPANEL_BUTTON_SIZE) {
      return items[idx]!.action
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

    // 2. Experience Bar (`D2Client.dll 0x6FAD6970`: two 1-px white lines at y = H - 38..H - 37, hidden at max level)
    const expFill = computeExpBarFill113c(
      state.xp,
      state.currentLevelXp,
      state.nextLevelXp,
      state.level,
      EXP_BAR_MAX_LEVEL,
      expBounds.width,
    )
    if (expFill > 0) {
      ctx.fillStyle = EXP_BAR_COLOR
      ctx.fillRect(expBounds.x, expBounds.y, expFill, 1)
      ctx.fillRect(expBounds.x, expBounds.y + 1, expFill, 1)
    }

    // 3. Stamina Bar (`D2Client.dll 0x6FAD78B0`: translucent fill over recessed panel art, red when w < 25)
    const displayStamina =
      state.frame !== undefined
        ? this.smoother.sample(10, state.stamina, state.maxStamina, state.frame)
        : state.stamina
    const stamVisual = computeStaminaBarVisual113c(
      state.stamina,
      state.maxStamina,
      Boolean(state.isStaminaBlue),
      stamBounds.width,
      displayStamina,
    )
    if (stamVisual.width > 0) {
      const prevAlpha = ctx.globalAlpha
      ctx.globalAlpha = STAMINA_BAR_TRANS_ALPHA
      ctx.fillStyle = stamVisual.color
      ctx.fillRect(stamBounds.x, stamBounds.y, stamVisual.width, stamBounds.height)
      ctx.globalAlpha = prevAlpha
    }

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

    // 6. Central Mini-panel Popup (`minipanel.dc6` 173x26 / `minipanel_s.dc6` 152x26 + `minipanelbtn.dc6` 20x20 icons at 21px pitch)
    if (this.isMiniPanelVisible) {
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
        const bx = startX + i * MINIPANEL_BUTTON_PITCH
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
    const miniBounds = this.currentMiniPanelBounds
    const miniTipCx = miniBounds.x + Math.round(miniBounds.width / 2)
    if (this.hoveredElement === 'exp') {
      const tmpl = resolveTblKey('panelexp', this.lang) ?? (isEn ? 'Experience: %u / %u' : '經驗： %u / %u')
      const text = tmpl
        .replace(/%[du]/, String(state.xp))
        .replace(/%[du]/, String(state.nextLevelXp))
      this.drawMiniTooltip(ctx, font, text, expBounds.x + 60, tipY)
    } else if (this.hoveredElement === 'stamina') {
      const tmpl = resolveTblKey('panelstamina', this.lang) ?? (isEn ? 'Stamina: %d / %d' : '耐力： %d / %d')
      const text = tmpl
        .replace(/%[du]/, String(stamVisual.tooltipCur))
        .replace(/%[du]/, String(stamVisual.tooltipMax))
      this.drawMiniTooltip(ctx, font, text, stamBounds.x + 51, tipY, stamVisual.tooltipColor)
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

  private drawMiniTooltip(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    text: string,
    cx: number,
    y: number,
    color: D2ColorCode = 'gold',
  ): void {
    const maxW = this.is640 ? 640 : 800
    const w = Math.max(120, font.measureText(text, 'fontexocet10') + 20)
    const x = Math.max(8, Math.min(maxW - w - 8, Math.round(cx - w / 2)))
    ctx.fillStyle = 'rgba(6, 6, 6, 0.92)'
    ctx.fillRect(x, y, w, 24)
    ctx.strokeStyle = '#8c7244'
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 23)
    font.drawText(ctx, text, x + Math.round(w / 2), y + 17, {
      font: 'fontexocet10',
      color,
      align: 'center',
    })
  }
}
