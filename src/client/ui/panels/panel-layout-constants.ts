import { D2FontRenderer } from '../font.ts'
import { isUiItemUnidentified, resolveUiSocketTargetCategory, type UiInventoryItem } from '../inventory.ts'
import { requireTbl } from '../../i18n/lang.ts'
import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import type { VendorTabId } from '../../../common/items/vendor-generator.ts'

export type LeftDockPanelKind =
  | 'none'
  | 'char'
  | 'quest'
  | 'waypoint'
  | 'stash'
  | 'cube'
  | 'vendor'
  | 'merc'
  | 'hire'
  | 'party'
  | 'msg'
  | 'trade'
  | 'imbue'
  | 'add_sockets'
  | 'personalize'
  | 'orifice'
  | 'barkscroll'
  | 'recipescroll'

export type WorldPanelType = LeftDockPanelKind

/**
 * D2Client.dll `0x6fb2cc60` (`BARKSCROLL_Draw`, `.data:0x6fbb6558..0x6fbb65a4`):
 * Cairn Stone rune (`scroin2.dc6`) and glow (`scroin3.dc6`) positions relative to panel origin `(ox, oy) = (80, 60)`.
 */
export const BARKSCROLL_RUNE_POS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 141, y: 120 },
  { x: 215, y: 158 },
  { x: 207, y: 268 },
  { x: 87, y: 263 },
  { x: 77, y: 170 },
]
export const BARKSCROLL_GLOW_POS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 161, y: 109 },
  { x: 235, y: 148 },
  { x: 227, y: 256 },
  { x: 107, y: 251 },
  { x: 96, y: 160 },
]
export const BARKSCROLL_STEP_THRESHOLDS: readonly [number, number, number, number, number] = [0, 12, 24, 36, 48]

export const HIRE_DIALOG_WIDTH = 490
export const HIRE_DIALOG_HEIGHT = 350
export const HIRE_LIST_Y_OFFSET = 35
export const HIRE_VISIBLE_CANDIDATES = 7
export const HIRE_ROW_HEIGHT = 34
export const HIRE_SLIDER_X_OFFSET = 472
export const HIRE_SLIDER_Y_OFFSET = 51
export const HIRE_TRACK_SEGMENTS = 21
export const HIRE_CONFIRM_WIDTH = 300
export const HIRE_CONFIRM_HEIGHT = 160

/**
 * D2Client.dll `0x6faf8c50` (`NPCMENU_Open`):
 * Anchors NPC interaction menu at `(npcScreenX, max(20, npcScreenY - 150))` above the NPC unit's head.
 */
export const NPC_MENU_HEAD_OFFSET_Y = 150
export const NPC_MENU_MIN_ANCHOR_Y = 20

/**
 * D2Client.dll `0x6fb53580` (`DIALOG_Layout`) & `0x6fb534b0` (`DIALOG_GetLineAtPoint`):
 * Grounded NPC stone dialog layout and hit-test constants.
 */
export const NPC_MENU_HEADER_STEP_Y = 21
export const NPC_MENU_OPTION_STEP_Y = 15
export const NPC_MENU_PAD_W = 20
export const NPC_MENU_PAD_H = 15
export const NPC_MENU_VIEWPORT_MIN_X = 10
export const NPC_MENU_VIEWPORT_MIN_Y = 10
export const NPC_MENU_VIEWPORT_BOTTOM_BAR_H = 48
export const NPC_MENU_HIT_PAD_X = 15
export const NPC_MENU_HIT_TOP_OFFSET = 11
export const NPC_MENU_HIT_BOTTOM_OFFSET = 4

/**
 * D2Client.dll `0x6fb53840` (`DIALOG_Draw`):
 * Translucent black stone box interior fill and NPC speech box dimensions.
 */
export const STONE_BOX_BG_FILL = 'rgba(0, 0, 0, 0.85)'
export const NPC_SPEECH_BOX_W = 325
export const NPC_SPEECH_BOX_H = 240
export const NPC_SPEECH_MIN_X = 20
export const NPC_SPEECH_MIN_Y = 40
export const NPC_SPEECH_BOTTOM_PAD_Y = 80
/**
 * Leading blank lines inserted above NPC speech text. The speech box auto-scrolls at
 * 16 px/s (one 16px line per second, the D2Client `0x6fb2bb86` pace) from the very first
 * rendered frame; without headroom the first text line starts flush against the top clip
 * edge and is pushed past it (invisible) within a second of the speech opening.
 */
export const NPC_SPEECH_LEADING_BLANK_LINES = 3

export function withNpcSpeechLeadLines(lines: readonly string[]): string[] {
  if (lines.length === 0) return []
  return [...new Array<string>(NPC_SPEECH_LEADING_BLANK_LINES).fill(''), ...lines]
}

/**
 * D2Client.dll `0x6fb3f260` / `0x6fb49720..0x6fb497c8` -> D2Win `#10085` (`0x6f8f33a0`):
 * Framed button hover tooltip dimensions and vendor status toast duration/position.
 */
export const BUTTON_HOVER_BOX_PAD_X = 6
export const BUTTON_HOVER_BOX_MIN_W = 24
export const BUTTON_HOVER_BOX_H = 22
export const BUTTON_HOVER_TEXT_OFFSET_Y = 17
export const VENDOR_BUTTON_HOVER_ANCHOR_Y = 380
export const VENDOR_STATUS_DURATION_MS = 2800
export const VENDOR_STATUS_TEXT_POS = { relX: 109, relY: 371 } as const

/**
 * D2Client.dll Quest Log & Waypoint Act Tab bar geometry (`Menu\expquesttabs.dc6`, `Menu\waygatetabs.dc6`):
 * 5 tabs starting at `ox + 4` with horizontal stride `62px` (`width = 62`, sprite frame width `63`),
 * vertical span `oy + 8 .. oy + 39` (`height = 31`).
 */
export const ACT_TAB_LAYOUT = {
  startXOffset: 4,
  strideX: 62,
  width: 62,
  frameWidth: 63,
  height: 31,
  topYOffset: 8,
  bottomYOffset: 39,
  count: 5,
} as const

/**
 * D2Client.dll 1.13c Quest Log slot table (`0x6fba8100`, 6 × 16-byte entries `{drawX, drawY, hitX, hitY}`,
 * panel-relative; see `kb/ui/d2client-quest-log-slots-113c.md`):
 * - Icon (`Menu\<aXqY>.dc6`, 72x86, frame offset `(0, -1)`) is drawn by `0x6facf2c1..0x6facf4e0` with the DC6
 *   bottom-left anchor at `(ox + drawX, oy + drawY)` (`ox = [0x6fbcb9a0] = 80`, `oy = -[0x6fbcb9a4] = 60`), i.e.
 *   top-left `(drawX + offsetX, drawY + offsetY - height)`. The mouse-down slot (`0x6fbd23f5`) is drawn 1px higher
 *   (`[0x6fbaa3fc] = -1`).
 * - Socket overlay (`Menu\questsockets.dc6`, 80x95, frame 1 when selected `0x6fbd23f9`) is drawn AFTER the icon by
 *   `0x6facf4f3..0x6facf558` at bottom-left `(drawX - 4, drawY + 5)`, 1px higher when selected (`[0x6fbaa3f8] = -1`).
 * - Click hit-test (`0x6facc7a0`): `hitX <= relX < hitX + 56`, `hitY <= relY < hitY + 52`.
 */
export const QUEST_SLOTS_113C: readonly { readonly drawX: number; readonly drawY: number; readonly hitX: number; readonly hitY: number }[] = [
  { drawX: 26, drawY: 121, hitX: 32, hitY: 65 },
  { drawX: 123, drawY: 121, hitX: 128, hitY: 65 },
  { drawX: 220, drawY: 121, hitX: 224, hitY: 65 },
  { drawX: 26, drawY: 218, hitX: 32, hitY: 163 },
  { drawX: 123, drawY: 218, hitX: 128, hitY: 163 },
  { drawX: 220, drawY: 218, hitX: 224, hitY: 163 },
]
/** `Menu\<aXqY>.dc6` frame geometry (all 27 frames of every quest icon file: 72x86, offset `(0, -1)`). */
export const QUEST_ICON_DC6_FRAME = { width: 72, height: 86, offsetX: 0, offsetY: -1 } as const
/** `Menu\questsockets.dc6` frame geometry (2 frames: 80x95, offset `(0, 0)`). */
export const QUEST_SOCKET_DC6_FRAME = { width: 80, height: 95, offsetX: 0, offsetY: 0 } as const
/** Click hit-rect size used by `0x6facc7a0`. */
export const QUEST_SLOT_HIT_SIZE = { w: 56, h: 52 } as const

/** Panel-relative top-left of the quest icon DC6 frame for slot `i` (`D2Client.dll` `0x6facf2c1..0x6facf4e0`). */
export function questIconTopLeft113c(i: number, mouseDown = false): { x: number; y: number } {
  const s = QUEST_SLOTS_113C[i]
  if (!s) throw new Error(`questIconTopLeft113c: invalid quest slot ${i}`)
  const f = QUEST_ICON_DC6_FRAME
  return { x: s.drawX + f.offsetX, y: s.drawY + f.offsetY - f.height + (mouseDown ? -1 : 0) }
}

/** Panel-relative top-left of the `questsockets.dc6` overlay for slot `i` (`D2Client.dll` `0x6facf4f3..0x6facf558`). */
export function questSocketTopLeft113c(i: number, selected: boolean): { x: number; y: number } {
  const s = QUEST_SLOTS_113C[i]
  if (!s) throw new Error(`questSocketTopLeft113c: invalid quest slot ${i}`)
  const f = QUEST_SOCKET_DC6_FRAME
  return { x: s.drawX - 4 + f.offsetX, y: s.drawY + 5 + (selected ? -1 : 0) + f.offsetY - f.height }
}

/** Panel-relative quest slot hit-test (`D2Client.dll` `0x6facc7a0`); returns slot index or `-1`. */
export function hitTestQuestSlot113c(relX: number, relY: number, slotCount: number): number {
  for (let i = 0; i < Math.min(slotCount, QUEST_SLOTS_113C.length); i++) {
    const s = QUEST_SLOTS_113C[i]!
    if (relX >= s.hitX && relX < s.hitX + QUEST_SLOT_HIT_SIZE.w && relY >= s.hitY && relY < s.hitY + QUEST_SLOT_HIT_SIZE.h) {
      return i
    }
  }
  return -1
}

export function computeNpcMenuAnchorY(npcScreenY: number): number {
  return Math.max(NPC_MENU_MIN_ANCHOR_Y, Math.round(npcScreenY) - NPC_MENU_HEAD_OFFSET_Y)
}

export function computeNpcMenuAnchor(npcScreenX: number, npcScreenY: number): { x: number; y: number } {
  return {
    x: Math.round(npcScreenX),
    y: computeNpcMenuAnchorY(npcScreenY),
  }
}

export const STASH_PANEL_ORIGIN = { x: 80, y: 60, width: 320, height: 432, w: 320, h: 432 } as const
export const STASH_GRID_ORIGIN = { x: 80 + 74, y: 60 + 82, cols: 6, rows: 8, cellPx: 29 } as const
/** Panel-relative click rect of the stash gold coin button (inclusive, D2Client stash panel). */
export const STASH_GOLD_BTN_HIT = { relX0: 73, relX1: 150, relY0: 24, relY1: 41 } as const
export const STASH_DEPOSIT_ALL_BTN = { relX0: 95, relX1: 220, relY0: 388, relY1: 410 } as const

/**
 * `Panel\TradeStash.dc6` (`public/ui/stash-bg.png`, 320x432 anchored at `ox = 80, oy = 60`)
 * header recessed dark boxes (Issue #493):
 * - Top box (`relY = 24..38`, height 15px) is divided by a vertical bar at `relX = 94..96` into:
 *   - Left icon socket: `relX = 74..93, relY = 24..38` (20x15px)
 *   - Right title text recess: `relX = 97..247, relY = 24..38` (151x15px, center `relX = 172, relY = 31`, alphabetic baseline `oy + 35`)
 * - Bottom gold text recess: `relX = 75..246, relY = 49..65` (172x17px, center `relX = 160, relY = 57`, alphabetic baseline `oy + 61`)
 */
export const STASH_HEADER_ICON_SOCKET = {
  x: 80 + 74,
  y: 60 + 24,
  relX: 74,
  relY: 24,
  w: 20,
  h: 15,
} as const

export const STASH_HEADER_TOP_RECESS = {
  x: 80 + 97,
  y: 60 + 24,
  relX: 97,
  relY: 24,
  w: 151,
  h: 15,
  textX: 80 + 172,
  textY: 60 + 35,
} as const

export const STASH_HEADER_BOTTOM_RECESS = {
  x: 80 + 75,
  y: 60 + 49,
  relX: 75,
  relY: 49,
  w: 172,
  h: 17,
  textX: 80 + 160,
  textY: 60 + 61,
} as const

/**
 * `Inventory.txt` `Transmogrify Box Page 1` / `Transmogrify Box2` (`supertransmogrifier.dc6` 3x4 grid):
 * `gridLeft = 198` (`80 + 118`), `gridTop = 199` (`60 + 139`), `gridBoxWidth = 29`, `gridBoxHeight = 29`.
 */
export const CUBE_PANEL_ORIGIN = { x: 80, y: 60, width: 320, height: 432, w: 320, h: 432 } as const
export const CUBE_GRID_ORIGIN = { x: 80 + 118, y: 60 + 139, cols: 3, rows: 4, cellPx: 29 } as const

/**
 * Horadric Cube Transmute button (`Panel\miniconvert.dc6`, 2 frames of 32x32)
 * per `D2Client.dll` `0x6fb3ce4b` (asset load), `0x6fb49657..0x6fb49698` (draw),
 * `0x6fb3b600` (hit-test), and `0x6fb4977a..0x6fb497c8` (hover tooltip):
 * - Draw: `x = ox + 0x90 = ox + 144` (`224`), `nYpos = oy + 480 - 0xbc = oy + 292` -> top-left `y = oy + 260` (`320`), `32x32`
 * - Frame `0` (unpressed) or Frame `1` (pressed, `ds:0x6fbcbe94`)
 * - Hit-test (`0x6fb3b600`): `relX ∈ (144, 184)`, `relY ∈ (257, 297)` (`x ∈ (224, 264)`, `y ∈ (317, 357)`)
 * - Hover tooltip (`0x6fb4977a`): `strIdx = 0xd0d = 3341` (`改變` / `Transmute`), `font16`, centered at `ox + 158` (`238`), anchored above `oy + 257` (`317`)
 */
export const CUBE_TRANSMUTE_BTN_BOUNDS = {
  x: 80 + 144,
  y: 60 + 260,
  relX: 144,
  relY: 260,
  w: 32,
  h: 32,
  hitMinX: 80 + 144,
  hitMaxX: 80 + 184,
  hitMinY: 60 + 257,
  hitMaxY: 60 + 297,
  tooltipCenterX: 80 + 158,
  tooltipAnchorY: 60 + 257,
  strIdx: 3341,
  labelZh: requireTbl('strUiMenu2', 'CHI'),
  labelEn: requireTbl('strUiMenu2', 'ENG'),
} as const

/**
 * Horadric Cube Close button (`Panel\buysellbtn.dc6`, frames 10/11 of 32x32)
 * per `D2Client.dll` `0x6fb49615..0x6fb49656` (draw), `0x6fb3b650` (hit-test),
 * and `0x6fb49732..0x6fb49775` (hover tooltip):
 * - Draw: `x = ox + 0x113 = ox + 275` (`355`), `nYpos = oy + 480 - 0x41 = oy + 415` -> top-left `y = oy + 383` (`443`), `32x32`
 * - Frame `10` (unpressed) or Frame `11` (pressed, `ds:0x6fbcbe8c`)
 * - Hit-test (`0x6fb3b650`): `relX ∈ (275, 315)`, `relY ∈ (380, 420)` (`x ∈ (355, 395)`, `y ∈ (440, 480)`)
 * - Hover tooltip (`0x6fb49732`): `strIdx = 0x1030 = 4144` (`關閉` / `Close`), `font16`, centered at `ox + 289` (`369`), anchored above `oy + 380` (`440`)
 */
export const CUBE_CLOSE_BTN_BOUNDS = {
  x: 80 + 275,
  y: 60 + 383,
  relX: 275,
  relY: 383,
  w: 32,
  h: 32,
  hitMinX: 80 + 275,
  hitMaxX: 80 + 315,
  hitMinY: 60 + 380,
  hitMaxY: 60 + 420,
  tooltipCenterX: 80 + 289,
  tooltipAnchorY: 60 + 380,
  strIdx: 4144,
  labelZh: requireTbl('strClose', 'CHI'),
  labelEn: requireTbl('strClose', 'ENG'),
} as const

export const VENDOR_PANEL_ORIGIN = { x: 80, y: 60, width: 320, height: 432, w: 320, h: 432 } as const
/** `Inventory.txt` row `Monster2`: gridLeft=96 (`80 + 16`), gridTop=123 (`60 + 63`), 10x10 cells of 29x29px */
export const VENDOR_GRID_ORIGIN = { x: 80 + 16, y: 60 + 63, cols: 10, rows: 10, cellPx: 29 } as const

/**
 * `Panel\buysell.dc6` (`public/ui/vendor-bg.png`, 320x432 anchored at `ox = 80, oy = 60`)
 * bottom-left stash gold recessed dark box per `D2Client.dll` `0x6fb494c5` -> `0x6fb3cfb0(2)`
 * (`0x6fb3d00e..0x6fb3d0da` & `0x6fb3d25d..0x6fb3d2a0`, Issue #833):
 * - Recess pixel bounds: `relX = 17..200` (`w = 184`), `relY = 359..375` (`h = 17`)
 * - Left label (`strIdx = 0xcf3 = 3315`, tbl key `'stash'`, `"Stash"` / `"儲藏箱"`):
 *   left-aligned at `relX = 21` (`ox + 0x15 = 101`), alphabetic baseline `oy + 371` (`431`), color `'white'`
 * - Right stash gold amount (`STAT_GOLDBANK` = stat 15):
 *   right-aligned to `relX = 198` (`ox + 0xc6 = 278`), alphabetic baseline `oy + 371` (`431`), color `'white'`
 */
export const VENDOR_GOLD_BOX_RECESS = {
  x: 80 + 17,
  y: 60 + 359,
  relX: 17,
  relY: 359,
  w: 184,
  h: 17,
  labelRelX: 21,
  amountRightRelX: 198,
  textRelY: 371,
  labelX: 80 + 21,
  amountRightX: 80 + 198,
  textY: 60 + 371,
} as const

/**
 * D2Client.dll vendor button geometry (`0x6fb45df1`, `0x6fb4c27a`, `0x6fb3f260`):
 * - Mode-3 button table X offsets (relative to panel X0=80): `{116, 169, 221, 273}`
 * - Sprite draw position: `x = X0 + tableX - 1` (`115, 168, 220, 272` relative), `y = panelTop + 385` (`445` absolute)
 * - Hit-test open intervals: `relX ∈ (tableX, tableX + 45)`, `relY ∈ (371, 415)`
 */
export const VENDOR_BUTTON_TABLE_X = [116, 169, 221, 273] as const
export const VENDOR_BUTTON_DRAW_Y = 385
export const VENDOR_BUTTON_HIT_Y_MIN = 371
export const VENDOR_BUTTON_HIT_Y_MAX = 415
export const VENDOR_BUTTON_HIT_W = 45

export type VendorButtonKind = 'blank' | 'buy' | 'sell' | 'repair' | 'repairAll' | 'close'
export type VendorTradeState = 'idle' | 'buy' | 'sell' | 'repair'

export interface VendorButtonSpec {
  readonly kind: VendorButtonKind
  readonly enabled: boolean
  readonly baseFrame: number
  readonly pressedFrame: number
  readonly strIdx: number
  readonly tblKey: string | null
  readonly labelZh: string
  readonly labelEn: string
  readonly paramA: number
  /** D2Client.dll `0x6fbbb238` (+0x10) `buysell.dc6` cursor frame index (`3` Buy, `4` Sell, `1` Repair, `null` none) */
  readonly cursorFrame: number | null
}

export const VENDOR_BUTTON_SPECS: Readonly<Record<VendorButtonKind, VendorButtonSpec>> = {
  blank: {
    kind: 'blank',
    enabled: false,
    baseFrame: 0,
    pressedFrame: 1,
    strIdx: 0,
    tblKey: null,
    labelZh: '',
    labelEn: '',
    paramA: 1,
    cursorFrame: null,
  },
  buy: {
    kind: 'buy',
    enabled: true,
    baseFrame: 2,
    pressedFrame: 3,
    strIdx: 3335,
    tblKey: 'NPCPurchaseItems',
    labelZh: requireTbl('NPCPurchaseItems', 'CHI'),
    labelEn: requireTbl('NPCPurchaseItems', 'ENG'),
    paramA: 2,
    cursorFrame: 3,
  },
  sell: {
    kind: 'sell',
    enabled: true,
    baseFrame: 4,
    pressedFrame: 5,
    strIdx: 3336,
    tblKey: 'NPCSellItems',
    labelZh: requireTbl('NPCSellItems', 'CHI'),
    labelEn: requireTbl('NPCSellItems', 'ENG'),
    paramA: 3,
    cursorFrame: 4,
  },
  repair: {
    kind: 'repair',
    enabled: true,
    baseFrame: 6,
    pressedFrame: 7,
    strIdx: 3338,
    tblKey: 'NPCRepairItems',
    labelZh: requireTbl('NPCRepairItems', 'CHI'),
    labelEn: requireTbl('NPCRepairItems', 'ENG'),
    paramA: 4,
    cursorFrame: 1,
  },
  repairAll: {
    kind: 'repairAll',
    enabled: true,
    baseFrame: 18,
    pressedFrame: 19,
    strIdx: 10095,
    tblKey: 'patchstring#95',
    labelZh: requireTbl('patchstring#95', 'CHI'),
    labelEn: requireTbl('patchstring#95', 'ENG'),
    paramA: 1,
    cursorFrame: null,
  },
  close: {
    kind: 'close',
    enabled: true,
    baseFrame: 10,
    pressedFrame: 11,
    strIdx: 4144,
    tblKey: 'strClose',
    labelZh: requireTbl('strClose', 'CHI'),
    labelEn: requireTbl('strClose', 'ENG'),
    paramA: 9,
    cursorFrame: null,
  },
}

/** D2Client.dll `0x6fb3f430` jump tables (`0x6fb3f5d4`, `0x6fb3f5e0`, `0x6fb3f618`) */
export const BLACKSMITH_CLASS_IDS: ReadonlySet<number> = new Set([154, 178, 253, 257, 511])
export const TRADER_CLASS_IDS: ReadonlySet<number> = new Set([147, 148, 177, 199, 202, 252, 254, 255, 405, 512, 513, 514])

export function resolveVendorButtonLayout(
  hcIdx: number,
  mode: 'trade' | 'gamble',
): readonly [VendorButtonKind, VendorButtonKind, VendorButtonKind, VendorButtonKind] {
  if (mode === 'gamble') return ['buy', 'sell', 'blank', 'close']
  if (BLACKSMITH_CLASS_IDS.has(hcIdx)) return ['buy', 'sell', 'repair', 'repairAll']
  if (TRADER_CLASS_IDS.has(hcIdx)) return ['buy', 'sell', 'blank', 'close']
  throw new Error(`D2Client 0x6fb3f430 assigns no trade buttons to MonStats class ${hcIdx}`)
}

/** D2Client.dll tab table at `0x6fb91178` (stride 18) & `buyselltabs.dc6` (`0x6fb45e5e–0x6fb45f5d`) */
export const VENDOR_TABS: readonly {
  readonly id: VendorTabId
  readonly index: 0 | 1 | 2 | 3
  readonly xOffset: number
  readonly width: number
  readonly height: number
  readonly centerX: number
  readonly textY: number
  readonly strIdx: number
  readonly tblKey: string
  readonly labelZh: string
  readonly labelEn: string
}[] = [
  {
    id: 'armor',
    index: 0,
    xOffset: 0,
    width: 79,
    height: 31,
    centerX: 42,
    textY: 20,
    strIdx: 4036,
    tblKey: 'strBSArmor',
    labelZh: requireTbl('strBSArmor', 'CHI'),
    labelEn: requireTbl('strBSArmor', 'ENG'),
  },
  {
    id: 'weapons1',
    index: 1,
    xOffset: 80,
    width: 79,
    height: 31,
    centerX: 121,
    textY: 20,
    strIdx: 4037,
    tblKey: 'strBSWeapons',
    labelZh: requireTbl('strBSWeapons', 'CHI'),
    labelEn: requireTbl('strBSWeapons', 'ENG'),
  },
  {
    id: 'weapons2',
    index: 2,
    xOffset: 160,
    width: 79,
    height: 31,
    centerX: 201,
    textY: 20,
    strIdx: 4037,
    tblKey: 'strBSWeapons',
    labelZh: requireTbl('strBSWeapons', 'CHI'),
    labelEn: requireTbl('strBSWeapons', 'ENG'),
  },
  {
    id: 'misc',
    index: 3,
    xOffset: 240,
    width: 79,
    height: 31,
    centerX: 281,
    textY: 20,
    strIdx: 4039,
    tblKey: 'strBSMisc',
    labelZh: requireTbl('strBSMisc', 'CHI'),
    labelEn: requireTbl('strBSMisc', 'ENG'),
  },
] as const

/**
 * MonStats classes whose NPC menu offers "gamble" in 1.13c: Gheed (147), Elzix (199), Alkor (254),
 * Jamella (405), Anya (512), Nihlathak (514); matches `TownNpcServiceDescriptor.canGamble`.
 */
export const GAMBLE_NPC_CLASS_IDS: ReadonlySet<number> = new Set([147, 199, 254, 405, 512, 514])
export function getItemQualityNumber(item: any): number {
  if (!item) return 2
  if (typeof item.quality === 'number') return item.quality
  const qStr = String(item.quality ?? item.rarity ?? '').toLowerCase()
  switch (qStr) {
    case 'low': case 'inferior': case 'cracked': case 'crude': case 'damaged': return 1
    case 'normal': return 2
    case 'superior': case 'hiquality': return 3
    case 'magic': return 4
    case 'set': return 5
    case 'rare': return 6
    case 'unique': return 7
    case 'crafted': return 8
    default: return 2
  }
}

const NON_IMBUE_QUEST_ITEM_CODES: ReadonlySet<string> = new Set([
  'msf',
  'hst',
  'vip',
  'g33',
  'qf1',
  'qf2',
  'hfh',
  'bks',
  'bkd',
  'j34',
  'g34',
  'xyz',
  'bbb',
  'ass',
  'tr1',
  'tr2',
  'mss',
  'qey',
  'qhr',
  'qbr',
  'ice',
])

export type UseItemPanelKind = 'imbue' | 'add_sockets' | 'personalize' | 'orifice'

export function isUseItemPanel(panel: string | null | undefined): panel is UseItemPanelKind {
  return panel === 'imbue' || panel === 'add_sockets' || panel === 'personalize' || panel === 'orifice'
}

/**
 * D2Client.dll `..\Source\D2Client\UI\useitem.cpp` (1.13c) layout, shared by the Horadric Orifice
 * (useitem mode 0, `0x58 OpenUi` action 0) and the Charsi Imbue / Larzuk Add Sockets / Anya Personalize
 * window (useitem mode 1, opened from the NPC menu; NPC class read from `0x6fbc9725`: 154 / 511 / 512).
 *
 * All coordinates are ABSOLUTE screen coordinates in both 640x480 and 800x600: useitem.cpp draws and
 * hit-tests with literal constants and never applies the 800x600 left-panel offsets (`0x6fbcb9a0` /
 * `0x6fbcb9a4`) that the inventory.txt-driven panels (buysell, stash, cube, ...) add.
 *
 * - `0x6fb4f750` loads `menu\upgrade` (mode 1) and `menu\horadricback` (mode 0), both 119x184 DC6.
 * - `0x6fb4f4b6`: D2GFX DrawCellContextEx(inset, 0x69, 0x10e, -1, 5) -> bottom-left anchored at (105, 270).
 * - `.data 0x6fb8ec60` button table (stride 0x28, count `0x6fb8ecb0` = 2), `panel\buysellbtn` frames:
 *   button 0 frame 16 (checkmark, +1 pressed) at (122, 256), hit [122..154]x[224..256];
 *   button 1 frame 10 (close, +1 pressed) at (177, 256), hit [177..209]x[224..256].
 * - `0x6fb503ae..0x6fb503d2`: item drop/pick rect [0x7b..0xd3]x[0x6a..0xdc] = [123..211]x[106..220].
 * - `0x6fb4fbf2..0x6fb4fc18`: placed item drawn 1:1 at x = 0xa7 - (w >> 1),
 *   y = 0x6a + (h < 0x70 ? (0x72 - h) >> 1 : 0).
 * - `0x6fb4f688..0x6fb4f718` (mode 1 only): instruction text in font16 (D2Win #10184 font 1), color 4 (gold),
 *   wrapped at 300 px (D2Win #10059), each line drawn at x = 160 - (w / 2), baseline y = 30 + 20 * line.
 * - `0x6fb4f590..0x6fb4f659`: hovering a button (mouse x < 320, y < screenH - 48) draws a D2GFX #10014
 *   rectangle (color 0, DRAWMODE_TRANS75) from (drawX - w/2 + 10, drawY - fh - 42) to (x1 + w + 12, y1 + fh + 6)
 *   and the font16 white label at (drawX - w/2 + 16, drawY - 38), fh = D2Win #10083 font height (tbl nHeight).
 * There is no full 320x432 panel background, no title, no item-name text and no [X] button.
 */
export const USE_ITEM_LAYOUT = {
  inset: { x: 0x69, bottomY: 0x10e, width: 119, height: 184 },
  slot: { left: 0x7b, right: 0xd3, top: 0x6a, bottom: 0xdc },
  item: { centerX: 0xa7, top: 0x6a, boxH: 0x72, tallThreshold: 0x70 },
  buttons: [
    { drawX: 122, drawY: 256, left: 122, right: 154, top: 224, bottom: 256, frame: 16 },
    { drawX: 177, drawY: 256, left: 177, right: 209, top: 224, bottom: 256, frame: 10 },
  ],
  text: { centerX: 0xa0, firstBaselineY: 0x1e, lineStep: 0x14, wrapWidth: 0x12c },
} as const

/** `.tbl` index aliases (pack-canonical-tbl.ts) of the useitem.cpp mode-1 instruction text (`0x6fb4f688`). */
export const USE_ITEM_INSTRUCTION_TBL: Readonly<Record<Exclude<UseItemPanelKind, 'orifice'>, string>> = {
  imbue: 'patchstring#76', // 0x275c "No Magic, Socketed, Rare, Unique, or Set Items. No Jewelry."
  add_sockets: 'expansionstring#2750', // 0x58de "Choose the item to which you wish to add sockets."
  personalize: 'expansionstring#2747', // 0x58db "Choose the item that you wish to personalize with your name."
}

/** `.tbl` index aliases of the button hover labels (`0x6fb4f5b3..0x6fb4f5e6`, `.data 0x6fb8ec60` word ids). */
export const USE_ITEM_BUTTON_TBL: Readonly<Record<UseItemPanelKind, readonly [string, string]>> = {
  orifice: ['string#3401', 'string#4143'], // "ok" / "close"
  imbue: ['string#4017', 'string#4143'], // "imbue" / "close"
  add_sockets: ['expansionstring#2748', 'string#4143'], // "add sockets" / "close"
  personalize: ['expansionstring#2749', 'string#4143'], // "personalize" / "close"
}

/** Hit-test a useitem.cpp button (0 = confirm, 1 = close) in absolute screen coordinates. */
export function hitTestUseItemButton(x: number, y: number): 0 | 1 | null {
  for (let i = 0; i < USE_ITEM_LAYOUT.buttons.length; i++) {
    const b = USE_ITEM_LAYOUT.buttons[i]!
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return i as 0 | 1
  }
  return null
}

/** Hit-test the useitem.cpp item drop/pick rectangle (`0x6fb503ae..0x6fb503d2`). */
export function hitTestUseItemSlot(x: number, y: number): boolean {
  const s = USE_ITEM_LAYOUT.slot
  return x >= s.left && x <= s.right && y >= s.top && y <= s.bottom
}

/**
 * Greedy word wrap at `maxW` px in font16 (D2Win #10059 splits on spaces; CJK text without spaces breaks
 * per character).
 */
export function wrapUseItemText(font: Pick<D2FontRenderer, 'measureText'>, text: string, maxW: number): string[] {
  const tokens = text.match(/\s*[\x21-\xff]+|\s*[^\s\x21-\xff]/g) ?? []
  const lines: string[] = []
  let line = ''
  for (const raw of tokens) {
    const word = raw.trimStart()
    const candidate = line ? `${line}${raw.startsWith(' ') ? ' ' : ''}${word}` : word
    if (line && font.measureText(candidate, 'font16') > maxW) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export function isEligibleArtisanItem(
  action: 'imbue' | 'add_sockets' | 'personalize' | 'orifice',
  item: UiInventoryItem | null | undefined,
): boolean {
  if (!item) return false
  if (action === 'orifice') {
    // D2Client.dll 0x6fb50455..0x6fb50473: requires identified item with dwClassId/code == 'hst ' (Horadric Staff)
    if (isUiItemUnidentified(item)) return false
    return (item.code ?? '').trim().toLowerCase() === 'hst'
  }
  const raw = item as any
  const qualityNum = getItemQualityNumber(item)
  const sockets =
    Number(raw.sockets ?? raw.totalSockets ?? (item.socketedItems?.length ?? 0)) ||
    (raw.socketed === true || raw.flags?.socketed === true || ((Number(raw.rawFlags) || 0) & 0x800) !== 0 ? 1 : 0)

  const code = String(item.code ?? raw.itemCode ?? raw.rawItem?.code ?? '').trim().toLowerCase()
  const tables = getEmbeddedDropTables()
  const weaponRow = code ? tables.weapons.byCode.get(code) : undefined
  const armorRow = code ? tables.armor.byCode.get(code) : undefined
  const miscRow = code ? tables.misc.byCode.get(code) : undefined

  const isWeaponOrArmor =
    !miscRow &&
    code !== 'aqv' &&
    code !== 'cqv' &&
    code !== 'ear' &&
    (Boolean(weaponRow || armorRow) ||
      raw.kind === 'weapon' ||
      raw.kind === 'armor' ||
      raw.rawItem?.base?.kind === 'weapon' ||
      raw.rawItem?.base?.kind === 'armor' ||
      (Array.isArray(item.allowedSlots) &&
        item.allowedSlots.some((s: string) =>
          [
            'weapon1',
            'weapon2',
            'armor',
            'helm',
            'shield',
            'gloves',
            'boots',
            'belt',
            'rArm',
            'lArm',
            'torso',
            'head',
          ].includes(s),
        )))

  if (action === 'imbue') {
    // D2Common.dll D2Common_10185 (ITEMS_CheckIfImbueable @ 0x6fd750b0):
    // 1. Must be identified
    if (isUiItemUnidentified(item)) return false
    // 2. Must be weapon or armor (never misc, quivers, jewelry, charms, runes, gems, potions, scrolls, tomes)
    if (!isWeaponOrArmor) return false
    if (NON_IMBUE_QUEST_ITEM_CODES.has(code) && code !== 'leg') return false
    if (code !== 'leg') {
      const questVal = Number(
        (weaponRow as any)?.quest ?? (armorRow as any)?.quest ?? raw.quest ?? raw.rawItem?.base?.quest ?? 0,
      )
      if (questVal > 0 || raw.isQuestItem === true) return false
    }
    if (weaponRow || armorRow) {
      const base = tables.getBase(code)
      if (base) {
        const tCode = String((base as any).type ?? '').trim().toLowerCase()
        const tDef = tCode ? tables.itemTypes.byCode.get(tCode) : undefined
        if (tDef && (tDef.normal || !tDef.rare)) return false
      }
    }
    // 3. Quality must be Low Quality (1), Normal (2), or Superior (3)
    if (qualityNum < 1 || qualityNum > 3) return false
    const rawQualStr = String(item.quality ?? raw.rarity ?? '').trim().toLowerCase()
    if (
      rawQualStr === 'magic' ||
      rawQualStr === 'set' ||
      rawQualStr === 'rare' ||
      rawQualStr === 'unique' ||
      rawQualStr === 'craft' ||
      rawQualStr === 'crafted' ||
      rawQualStr === 'tempered' ||
      rawQualStr === 'rune'
    ) {
      return false
    }
    // 4. Must have 0 sockets (0x6fd750f6..0x6fd75106)
    if (sockets > 0) return false
    // 5. Reject Ethereal Throwing Weapons (0x6fd7510a..0x6fd7511a); allow non-throwing ethereal weapons & ethereal armor
    const isEthereal = Boolean(
      raw.isEthereal ||
        raw.ethereal ||
        raw.flags?.ethereal ||
        raw.rawItem?.ethereal ||
        (typeof raw.flags === 'number' && (raw.flags & 0x00400000) !== 0) ||
        (typeof raw.rawFlags === 'number' && (raw.rawFlags & 0x00400000) !== 0),
    )
    if (isEthereal) {
      const wType = String(weaponRow?.type ?? raw.type ?? raw.rawItem?.base?.type ?? '').trim().toLowerCase()
      const isThrowing = Boolean(
        raw.isThrowing === true ||
          (wType &&
            (wType === 'thro' ||
              wType === 'tkni' ||
              wType === 'taxe' ||
              wType === 'jav' ||
              wType === 'ajav' ||
              tables.isA(wType, 'thro'))),
      )
      if (isThrowing) return false
    }
    return true
  }

  if (action === 'add_sockets') {
    if (!isWeaponOrArmor) return false
    if (sockets > 0) return false
    if (qualityNum > 7) return false
    const targetCat = resolveUiSocketTargetCategory(item)
    if (!targetCat) {
      const allowed = Array.isArray(item.allowedSlots) ? item.allowedSlots : []
      const isSocketableSlot = allowed.some((s: string) =>
        ['weapon1', 'weapon2', 'armor', 'helm', 'rArm', 'lArm', 'torso', 'head'].includes(s),
      )
      if (!isSocketableSlot && raw.kind !== 'weapon' && raw.kind !== 'armor') return false
    }
    return true
  }

  if (action === 'personalize') {
    if (!isWeaponOrArmor) return false
    if (raw.personalized || raw.personalizedName) return false
    return true
  }

  return true
}
