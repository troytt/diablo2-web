/**
 * Canonical 1.13c client-side Quest Log & Quest Alert state machine.
 *
 * Verified against `D2Client.dll` (1.13c):
 * - `0x6fba8188` (`41 × 16B` quest descriptor table: `{ b0, b1, local, act, stateTablePtr, questId, fidx }`)
 * - `0x6facc890` (`questLogRowIndex`: linear scan of `0x6fba8188` by `+0x08` `questId`)
 * - `0x6face160` (`S2C 0x5D` quest status / alert handler; `0x6facc940` highlight setter)
 * - `0x6facdd50` (`S2C 0x52` 41-byte quest status array copy + `selectForActTab(actTab, 1)`)
 * - `0x6facc740` (`S2C 0x50` quest item/counter sync: `type === 1` -> Den, Tal Rasha tomb offset, Mount Arreat barbs)
 * - `0x6facda90` (`selectForActTab(act, resetHighlights)`)
 * - `0x6face940` / `0x6face7e0` / `0x6facddf0` (Quest Log panel open / close / act-tab click)
 * - `0x6face5f0` / `0x6facdd90` / `0x6facf900` / `0x6facd840` / `0x6facc980` / `0x6fba9e20` / `0x6fb7dca0`
 *   (UI `0x11` bottom-left "Quest Log" alert button draw, press, release, hit-test, and resolution-dependent rect table)
 * - `0x6facce00..0x6facd6dc` (Quest Log page text & NPC speech key builder)
 */

import { CANONICAL_QUEST_STATE_TABLES } from '../../common/data/canonical-quest-data.ts'

export const QUEST_LOG_ROW_COUNT = 41

/**
 * `D2Client.dll` `0x6fba7990` (`g_aszQuestIconFiles`, 27 entries):
 * MPQ DC6 quest icon filenames (`data\global\ui\MENU\<name>.dc6`) indexed by descriptor `+0x01` (`b1 = 0..26`).
 */
export const QUEST_ICON_FILES_113C: readonly string[] = [
  'a1q1',
  'a1q2',
  'a1q3',
  'a1q4',
  'a1q5',
  'a1q6',
  'a2q1',
  'a2q2',
  'a2q3',
  'a2q4',
  'a2q5',
  'a2q6',
  'a3q1',
  'a3q2',
  'a3q3',
  'a3q4',
  'a3q5',
  'a3q6',
  'a4q1',
  'a4q2',
  'a4q3',
  'a5q1',
  'a5q2',
  'a5q3',
  'a5q4',
  'a5q5',
  'a5q6',
]

export interface QuestLogDescriptor {
  readonly row: number
  readonly questId: number
  readonly act: number
  readonly local: number
  readonly b1: number
  readonly hasTable: boolean
  readonly rp: number
}

/**
 * All 41 rows of `D2Client.dll` `0x6fba8188` (`j = 0..40`, matching the 41 status bytes in `S2C 0x52`
 * and the first 41 word indices in `S2C 0x28` / `0x29`).
 * `+0x01` (`b1`) indexes `QUEST_ICON_FILES_113C` (`0..26`) for playable quests (`hasTable === true`),
 * or `0xff` for sentinel / travel / filler rows (`hasTable === false`).
 */
export const QUEST_LOG_DESCRIPTORS: readonly QuestLogDescriptor[] = [
  // Act I (act 0)
  { row: 0, questId: 0x25, act: 0, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 1, questId: 0x01, act: 0, local: 0, b1: 0, hasTable: true, rp: 4 },
  { row: 2, questId: 0x02, act: 0, local: 1, b1: 1, hasTable: true, rp: 2 },
  { row: 3, questId: 0x03, act: 0, local: 4, b1: 2, hasTable: true, rp: 0xffff },
  { row: 4, questId: 0x04, act: 0, local: 2, b1: 3, hasTable: true, rp: 0xffff },
  { row: 5, questId: 0x05, act: 0, local: 3, b1: 4, hasTable: true, rp: 0xffff },
  { row: 6, questId: 0x06, act: 0, local: 5, b1: 5, hasTable: true, rp: 9 },
  { row: 7, questId: 0x25, act: 0, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  // Act II (act 1)
  { row: 8, questId: 0x25, act: 1, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 9, questId: 0x08, act: 1, local: 0, b1: 6, hasTable: true, rp: 2 },
  { row: 10, questId: 0x09, act: 1, local: 1, b1: 7, hasTable: true, rp: 0xffff },
  { row: 11, questId: 0x0a, act: 1, local: 2, b1: 8, hasTable: true, rp: 0xffff },
  { row: 12, questId: 0x0b, act: 1, local: 3, b1: 9, hasTable: true, rp: 0xffff },
  { row: 13, questId: 0x0c, act: 1, local: 4, b1: 10, hasTable: true, rp: 0xffff },
  { row: 14, questId: 0x0d, act: 1, local: 5, b1: 11, hasTable: true, rp: 4 },
  { row: 15, questId: 0x25, act: 1, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  // Act III (act 2)
  { row: 16, questId: 0x25, act: 2, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 17, questId: 0x0f, act: 2, local: 3, b1: 12, hasTable: true, rp: 0xffff },
  { row: 18, questId: 0x10, act: 2, local: 2, b1: 13, hasTable: true, rp: 0xffff },
  { row: 19, questId: 0x11, act: 2, local: 1, b1: 14, hasTable: true, rp: 0xffff },
  { row: 20, questId: 0x12, act: 2, local: 0, b1: 15, hasTable: true, rp: 4 },
  { row: 21, questId: 0x13, act: 2, local: 4, b1: 16, hasTable: true, rp: 3 },
  { row: 22, questId: 0x14, act: 2, local: 5, b1: 17, hasTable: true, rp: 4 },
  { row: 23, questId: 0x25, act: 2, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  // Act IV (act 3)
  { row: 24, questId: 0x25, act: 3, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 25, questId: 0x16, act: 3, local: 0, b1: 18, hasTable: true, rp: 0xffff },
  { row: 26, questId: 0x17, act: 3, local: 2, b1: 20, hasTable: true, rp: 0xffff },
  { row: 27, questId: 0x18, act: 3, local: 1, b1: 19, hasTable: true, rp: 0xffff },
  { row: 28, questId: 0x25, act: 3, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  // Unused filler rows (act 9)
  { row: 29, questId: 0x25, act: 9, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 30, questId: 0x25, act: 9, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 31, questId: 0x25, act: 9, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 32, questId: 0x25, act: 9, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 33, questId: 0x25, act: 9, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  // Act V (act 4)
  { row: 34, questId: 0x1e, act: 4, local: 0, b1: 0xff, hasTable: false, rp: 0xffff },
  { row: 35, questId: 0x1f, act: 4, local: 0, b1: 21, hasTable: true, rp: 0xffff },
  { row: 36, questId: 0x20, act: 4, local: 1, b1: 22, hasTable: true, rp: 0xffff },
  { row: 37, questId: 0x21, act: 4, local: 2, b1: 23, hasTable: true, rp: 0xffff },
  { row: 38, questId: 0x22, act: 4, local: 3, b1: 24, hasTable: true, rp: 0xffff },
  { row: 39, questId: 0x23, act: 4, local: 4, b1: 25, hasTable: true, rp: 3 },
  { row: 40, questId: 0x24, act: 4, local: 5, b1: 26, hasTable: true, rp: 0xffff },
]

/**
 * `D2Client.dll` `0x6facc890`: find the first descriptor row (`0..40`) whose `+0x08` `questId` matches `q`,
 * or `-1` if not found.
 */
export function questLogRowIndex(questId: number): number {
  for (let i = 0; i < QUEST_LOG_DESCRIPTORS.length; i++) {
    if (QUEST_LOG_DESCRIPTORS[i]!.questId === questId) return i
  }
  return -1
}

export interface QuestAlertRect {
  readonly entryIndex: 0 | 1 | 2 | 3
  readonly x1: number
  readonly x2: number
  readonly y1: number
  readonly y2: number
  readonly yText: number
}

/**
 * Base 640x480 rect table `0x6fba9e20` (`4 × 20B`, populated at startup by `0x6fb7dca0` when `W=640, H=480`).
 */
const QUEST_ALERT_BASE_RECTS: readonly Omit<QuestAlertRect, 'entryIndex'>[] = [
  { x1: 40, x2: 75, y1: 340, y2: 375, yText: 337 },
  { x1: 360, x2: 395, y1: 340, y2: 375, yText: 337 },
  { x1: 40, x2: 75, y1: 285, y2: 320, yText: 282 },
  { x1: 360, x2: 395, y1: 285, y2: 320, yText: 282 },
]

/**
 * Compute the UI `0x11` Quest Alert button rect for `640x480` or `800x600` per `D2Client.dll`
 * `0x6facc980` (entry selector) and `0x6face5f0` / `0x6facd840` (runtime `H - 480` and mode-2 `(W - 640) / 2` offsets).
 *
 * `panelMode`: `(leftPanelOpen ? 2 : 0) | (rightPanelOpen ? 1 : 0)` (`0x6fbcc414`).
 * `charOpen`: `leftPanel === 'char'` (UI `0x02`, `0x6fbaad88`).
 */
export function questAlertRect(width: 640 | 800, panelMode: number, charOpen: boolean): QuestAlertRect {
  const is800 = width === 800
  const height = is800 ? 600 : 480
  let entryIndex: 0 | 1 | 2 | 3
  if (panelMode === 2) {
    entryIndex = is800 || charOpen ? 1 : 3
  } else {
    entryIndex = is800 ? 0 : 2
  }
  const base = QUEST_ALERT_BASE_RECTS[entryIndex]!
  const dx = panelMode === 2 ? Math.trunc((width - 640) / 2) : 0
  const dy = height - 480
  return {
    entryIndex,
    x1: base.x1 + dx,
    x2: base.x2 + dx,
    y1: base.y1 + dy,
    y2: base.y2 + dy,
    yText: base.yText + dy,
  }
}

/**
 * `D2Client.dll` `0x6facd840`: strict bounding-box hit test (`x1 < x < x2 && y1 < y < y2`).
 */
export function questAlertHit(rect: QuestAlertRect, x: number, y: number): boolean {
  return x > rect.x1 && x < rect.x2 && y > rect.y1 && y < rect.y2
}

export type QuestLogPageText =
  | { readonly kind: 'tbl'; readonly key: string }
  | { readonly kind: 'appendCount'; readonly key: string; readonly count: number }
  | { readonly kind: 'printfCount'; readonly key: string; readonly count: number }

export interface QuestLogPage {
  readonly text: QuestLogPageText
  readonly speechKey: string | null
}

function normalizeSpeechKey(key: string | undefined): string | null {
  if (!key || key === 'qstsnull' || key === 'NONE') return null
  return key
}

/**
 * Port of `D2Client.dll` `0x6facce00..0x6facd6dc`: resolve the Quest Log body text specification
 * and replayable NPC speech key for descriptor row `row` (`0..40`).
 *
 * Returns `null` when the quest page is unstarted / blank (mode 2 at `0x6facd6cc`, or out-of-range status).
 * Note: the binary's per-quest icon animation state (`0x6fbd24c0`) and page mode (`+0x266`) are not modelled here.
 */
export function buildQuestLogPage(params: {
  readonly row: number
  readonly playerWords: ArrayLike<number>
  readonly gameWords?: ArrayLike<number> | undefined
  readonly status: number
  readonly den: number
  readonly barbs: number
  readonly multiplayer?: boolean | undefined
}): QuestLogPage | null {
  const { row, playerWords, gameWords, den, barbs } = params
  const multiplayer = params.multiplayer ?? true
  const desc = QUEST_LOG_DESCRIPTORS[row]
  const table = CANONICAL_QUEST_STATE_TABLES[row]
  if (!desc || !desc.hasTable || !table) return null

  const pw = (playerWords[row] ?? 0) & 0xffff
  const gw = (gameWords?.[row] ?? 0) & 0xffff
  let s = params.status & 0xff

  const A = (pw & 0x0001) !== 0 // bit 0: reward granted (QUESTSTATEFLAG_PRIMARYGOALACHIEVED)
  const C = (pw & 0x0002) !== 0 // bit 1: reward pending (QUESTSTATEFLAG_REWARDPENDING)
  const B = (pw & 0x2000) !== 0 // bit 13: completed in current game (QUESTSTATEFLAG_COMPLETEDNOW)

  const slotPage = (k: number): QuestLogPage => ({
    text: { kind: 'tbl', key: table[k]?.text ?? 'qstsnull' },
    speechKey: normalizeSpeechKey(table[k + 1]?.speech),
  })

  // 1. Row 35 (A5Q1 Siege on Harrogath, `0x6faccef7`): if C, force s=4 when s==0 and jump to NORMAL_S.
  let skipToNormalS = false
  if (row === 35 && C) {
    if (s === 0) s = 4
    skipToNormalS = true
  }

  if (!skipToNormalS) {
    // 2. Row 14 (A2Q6 Tal Rasha's Tomb / Duriel, `0x6faccf1d`)
    let enterGeneral = true
    let enterRpPath = false
    if (row === 14) {
      if (A) {
        enterGeneral = true
      } else if (B) {
        enterGeneral = false
        enterRpPath = true
      } else {
        const pw12 = (playerWords[12] ?? 0) & 0xffff
        if (((pw12 & 0x0001) !== 0 || (pw12 & 0x2000) !== 0) && s === 1) {
          return slotPage(7)
        }
        if ((pw & 0x0008) !== 0) {
          return slotPage(5)
        }
        if ((pw & 0x0010) !== 0) {
          return slotPage(6)
        }
        enterGeneral = false
        enterRpPath = false
      }
    }

    // 3. GENERAL (`0x6facd064`): check B (bit 13) and A (bit 0)
    if (enterGeneral) {
      if (B && A) {
        return {
          text: { kind: 'tbl', key: 'qstsComplete' },
          speechKey: normalizeSpeechKey(table[0]?.text),
        }
      }
      if (B && !A) {
        enterRpPath = true
      } else if (!B && A) {
        return {
          text: { kind: 'tbl', key: 'qstsprevious' },
          speechKey: normalizeSpeechKey(table[0]?.text),
        }
      }
    }

    // 4. RP_PATH (`0x6facd07c`): reward-pending slot via descriptor `rp`
    let skipPath18c = false
    if (enterRpPath) {
      if (desc.rp === 0xffff) {
        skipPath18c = false
      } else if (!C) {
        skipPath18c = true
      } else if (row === 25) {
        skipPath18c = false
      } else {
        return slotPage(desc.rp + 1)
      }
    }

    // 5. PATH18C (`0x6facd18c`): C (bit 1) && bit 15 -> slot 10 (or 5/6 for row 37)
    if (!skipPath18c && C && (pw & 0x8000) !== 0) {
      let k = 10
      if (row === 37) {
        if ((pw & 0x0100) !== 0 && (pw & 0x0200) === 0) {
          k = 6
        } else if ((pw & 0x0100) === 0) {
          k = 5
        }
      }
      const textKey = table[k]?.text
      if (!textKey || textKey === 'qstsnull') return null
      return slotPage(k)
    }

    // 6. NORMAL (`0x6facd281`): s == 0 -> S0
    if (s === 0) {
      const thankYouKey = multiplayer ? 'qstsThankYouComeAgainMulti' : 'qstsThankYouComeAgain'
      if ((gw & 0x2000) !== 0) {
        if (row === 21) {
          const pw21 = (playerWords[21] ?? 0) & 0xffff
          if ((pw21 & 0x0001) === 0 && (pw21 & 0x0010) !== 0) {
            return { text: { kind: 'tbl', key: 'qstsa3q53' }, speechKey: null }
          }
        }
        if (B || C) return null
        return { text: { kind: 'tbl', key: thankYouKey }, speechKey: null }
      }
      if ((gw & 0x8000) === 0) return null
      if (B || C) return null
      return { text: { kind: 'tbl', key: thankYouKey }, speechKey: null }
    }
  }

  // 7. NORMAL_S (`0x6facd28d`): s != 0
  // Safety bound: each state table has 16 entries (0..15) and speech reads slot s + 1.
  if (s < 1 || s > 14) return null

  const titleKey = table[0]?.speech
  const speechKey = normalizeSpeechKey(table[s + 1]?.speech)

  // Den of Evil (`titleKey === 'qstsa1q1'`, `0x6facd29e..0x6facd406`)
  if (titleKey === 'qstsa1q1') {
    const slotText = table[s]?.text ?? 'qstsnull'
    if (s === 3 || s === 4) {
      if (den > 1) {
        return {
          text: { kind: 'appendCount', key: s === 4 ? slotText : '', count: den },
          speechKey,
        }
      }
      return {
        text: { kind: 'tbl', key: 'qstsa1q140' },
        speechKey,
      }
    }
    return {
      text: { kind: 'tbl', key: slotText },
      speechKey,
    }
  }

  // Other quests (`0x6facd40b..0x6facd554`)
  const multiCase = (!A && !B && !C && (gw & 0x2000) !== 0 && row !== 19) || (pw & 0x4000) !== 0
  if (multiCase) {
    return {
      text: {
        kind: 'tbl',
        key: multiplayer ? 'qstsThankYouComeAgainMulti' : 'qstsThankYouComeAgain',
      },
      speechKey,
    }
  }

  let key = table[s]?.text ?? 'qstsnull'
  if (key === 'qstsother' && !multiplayer) {
    key = 'qstsThankYouComeAgain'
  }
  if (titleKey === 'qstsa5q2' && key === 'qstsa5q22') {
    if (barbs === 0) {
      return {
        text: { kind: 'tbl', key: 'qstsThankYouComeAgain' },
        speechKey,
      }
    }
    return {
      text: { kind: 'printfCount', key: 'qstsa5q22', count: barbs },
      speechKey,
    }
  }

  return {
    text: { kind: 'tbl', key },
    speechKey,
  }
}

/** Quest Log descriptor row of A2Q6 The Seven Tombs (`QUEST_LOG_DESCRIPTORS[14]`). */
export const A2Q6_QUEST_LOG_ROW = 14
/** A2Q6 state-table page index that shows the True Tomb symbol (`[rec + 0x265] == 7`, `D2Client.dll` `0x6facf477`). */
export const A2Q6_TRUE_TOMB_PAGE_SLOT = 7
/** TBL key of that page (`[rec + 0x5] == 0x3a0`, `D2Client.dll` `0x6facf46c`): "The Symbol of the True Tomb of Tal Rasha." */
export const A2Q6_TRUE_TOMB_TEXT_KEY = 'qstsa2q61a'
/** `invps.dc6`: 7 frames of 102x93, one per Tal Rasha tomb (`D2Client.dll` `0x6facda26`). */
export const INVPS_FRAME_W = 102
export const INVPS_FRAME_H = 93
/**
 * `invps.dc6` bottom-left anchor relative to the quest panel origin: `x = [0x6fbcb9a0] + 0x6e`,
 * `y = [0x6fbcb9a4] + screenH - 0x6e` (`D2Client.dll` `0x6facf5bd..0x6facf5dd`) = `(110, 370)` in 800x600.
 */
export const INVPS_DRAW_REL_X = 0x6e
export const INVPS_DRAW_REL_BOTTOM_Y = 370

/**
 * Port of `D2Client.dll` `0x6facf46c..0x6facf480` + `0x6facf589..0x6facf5b5` (Issue #1008):
 * returns the `invps.dc6` frame to draw in the Quest Log text box, or `null` when no symbol is drawn.
 *
 * The symbol is drawn only when the selected quest is A2Q6 (selected slot `[0x6fbd23f9] == 5` on the Act II tab)
 * and its current page is state-table slot 7 (`qstsa2q61a`). The frame is the server tomb offset
 * (`S2C 0x50` type 1, `0x6facc740` -> `[0x6fbd23e8]`), replaced by `0` when `< 0` or `> 6`.
 */
export function trueTombSymbolFrame113c(
  questId: string,
  page: QuestLogPage | null | undefined,
  tombOffset: number | null | undefined,
): number | null {
  if (questId !== 'a2q6') return null
  if (page?.text.key !== A2Q6_TRUE_TOMB_TEXT_KEY) return null
  const offset = (tombOffset ?? 0) | 0
  return offset < 0 || offset > 6 ? 0 : offset
}

export interface QuestSelectRequest {
  readonly seq: number
  readonly act: number
  readonly local: number
}

/**
 * Stateful client Quest Log & Quest Alert controller (`D2Client.dll` `0x6fbd23d8..0x6fbd3395`).
 */
export class QuestLogState {
  /** `0x6fbd2496` (`41B` status byte array; `0x6fbd2495` in the binary precedes it with `0x52` opcode). */
  readonly statusBytes = new Uint8Array(QUEST_LOG_ROW_COUNT)
  /** `0x6fbd23d8`: `0` = idle, `1` = alert pending, `2` = quest log panel open. */
  alertState: 0 | 1 | 2 = 0
  /** UI `0x11` (`0x6fbaadc4`): whether the bottom-left "Quest Log" alert button is shown. */
  alertVisible = false
  /** `0x6fbd23f0`: whether the alert button is currently held down by the mouse. */
  alertPressed = false
  /** `0x6fbd23f4` (`5 × i32`, initialized to `-1`): per-act highlighted local quest index (`0..5`). */
  readonly highlights = new Int32Array([-1, -1, -1, -1, -1])
  /** `0x6fbd23e4`: Den of Evil remaining monster counter (`S2C 0x5D` `flags & 0x20` / `S2C 0x50` type 1). */
  den = 0
  /** `0x6fbd23e8`: Tal Rasha tomb offset (`S2C 0x50` type 1). */
  tombOffset = 0
  /** `0x6fbd23ec`: Rescue on Mount Arreat remaining soldiers (`S2C 0x5D` `q=0x20` / `S2C 0x50` type 1). */
  barbs = 0
  /** `0x6fbd1594`: A1Q3 Cairn Stone activation order (`S2C 0x50` type 4 -> `0x6fb2cf50`). */
  cairnStoneOrder: [number, number, number, number, number] | null = null
  /** UI `0x0F` (`0x6fbaad98`): whether the Quest Log panel is currently open. */
  questPanelOpen = false
  /** `0x6fbd3395`: active 0-based act tab (`0..4`). */
  actTab = 0
  /** Monotonic selection update emitted by `0x5D` (while open) or `0x52`. */
  selectRequest: QuestSelectRequest | null = null
  private selectSeq = 0

  private pushSelectRequest(act: number, local: number): void {
    this.selectSeq++
    this.selectRequest = { seq: this.selectSeq, act, local }
  }

  /**
   * Handle `S2C 0x5D` (`0x6face160`).
   *
   * Note: `flags & 1`, `flags & 2`, `flags === 0x10`, `q === 0x21` (`flags & 0x20` unit iterator), and `q === 0x17` (`0x6fb021a0`)
   * visual/unit/sound side-effects are not modelled and return early as in the binary.
   */
  apply5D(
    questId: number,
    alertFlags: number,
    filterStatus: number,
    extraSigned: number,
    context: {
      readonly denQuestWord: number
      readonly playerDeadOrDying: boolean
    },
  ): void {
    const q = questId & 0xff
    const flags = alertFlags & 0xff
    const state = filterStatus & 0xff
    const s16 = (extraSigned << 16) >> 16

    // 1. flags & 1 -> client effect callback (gap), return.
    if ((flags & 0x01) !== 0) {
      return
    }
    // 2. flags & 2 -> client effect callback (gap), return.
    if ((flags & 0x02) !== 0) {
      return
    }
    // 3. flags == 0x10 -> quest sound triggers (gap), return.
    if (flags === 0x10) {
      return
    }
    // 4. flags & 0x20 -> counter updates
    if ((flags & 0x20) !== 0) {
      if (q === 0x20) {
        this.barbs = s16
        // Fall through to common path.
      } else if (q === 0x21) {
        // Unit flag clear for class 0x20f (gap), return.
        return
      } else {
        // Den of Evil counter branch (`0x6face25b..0x6face2bf`)
        if ((context.denQuestWord & 0x0001) !== 0 || (context.denQuestWord & 0x0002) !== 0) {
          return
        }
        this.den = s16
        const row1 = questLogRowIndex(1)
        if (s16 > 5 || s16 < 0) {
          this.den = 666
          if (row1 >= 0) this.statusBytes[row1] = state
          return
        }
        if (s16 !== 5) {
          if (row1 >= 0) this.statusBytes[row1] = state
          return
        }
        if (q === 0x17) {
          return
        }
        // When s16 === 5 and q !== 0x17, fall through to common path (pops the Quest Alert button).
      }
    }

    // 5. Common path (`0x6face2d6`)
    if (this.alertState !== 0) {
      if (!this.questPanelOpen) return
      const row = questLogRowIndex(q)
      if (row < 0) return
      this.statusBytes[row] = state
      const desc = QUEST_LOG_DESCRIPTORS[row]!
      if (desc.act === this.actTab) {
        this.pushSelectRequest(desc.act, desc.local)
      }
      return
    }

    // 6. Common path when alertState === 0 (`0x6face337`)
    // UI type loop (`+0x44`): type 2 (UI 0x0F quest panel) or type 3 (UI 0x11 quest alert) aborts.
    if (this.questPanelOpen || this.alertVisible) {
      return
    }
    if (!context.playerDeadOrDying) {
      this.alertVisible = true
    }
    const row = questLogRowIndex(q)
    if (row >= 0) {
      const desc = QUEST_LOG_DESCRIPTORS[row]!
      if (desc.act >= 0 && desc.act < this.highlights.length) {
        this.highlights[desc.act] = desc.local
      }
    }
    this.alertState = 1
  }

  /**
   * Handle `S2C 0x52` (`0x6facdd50`): copy the 41 quest status bytes, clear `alertPressed`,
   * and run `selectForActTab(actTab, true)` (consuming highlights even if the panel is closed).
   */
  apply52(bytes: ArrayLike<number>): void {
    const len = Math.min(QUEST_LOG_ROW_COUNT, bytes.length)
    for (let i = 0; i < len; i++) {
      this.statusBytes[i] = (bytes[i] ?? 0) & 0xff
    }
    this.alertPressed = false
    const local = this.selectForActTab(this.actTab, true)
    this.pushSelectRequest(this.actTab, local)
  }

  /**
   * Handle `S2C 0x50` (`0x6facc740` / `0x6fb56ca0`):
   * - when `words[0] === 1`, update `den`, `tombOffset`, and `barbs`.
   * - when `words[0] === 4`, update `cairnStoneOrder` (`0x6fb2cf50`).
   * - when `words[0] === 36`, update `barbs`.
   */
  apply50(words: ArrayLike<number>): void {
    const type = (words[0] ?? 0) & 0xffff
    if (type === 1) {
      this.den = (words[1] ?? 0) & 0xffff
      this.tombOffset = (words[2] ?? 0) & 0xffff
      this.barbs = (words[3] ?? 0) & 0xffff
    } else if (type === 4) {
      this.cairnStoneOrder = [
        (words[1] ?? 0) & 0xffff,
        (words[2] ?? 0) & 0xffff,
        (words[3] ?? 0) & 0xffff,
        (words[4] ?? 0) & 0xffff,
        (words[5] ?? 0) & 0xffff,
      ]
    } else if (type === 36) {
      this.barbs = (words[1] ?? 0) & 0xffff
    }
  }

  /**
   * `D2Client.dll` `0x6facda90`: select a quest for `act` (`0..4`).
   * If `highlights[act] !== -1`, selects that local index and (when `reset` is true) resets all 5 highlights to `-1`.
   * Otherwise runs the binary's fallback scan over the per-quest icon-animation flags (`0x6fbd24c0` /
   * descriptor `+0x263`) — an animating icon marks a started, unfinished quest — and selects the first
   * one of the act; the port supplies this as `fallbackScan` (world-panel quest statuses), keeping the
   * `-1` result when the scan is absent or finds nothing.
   */
  selectForActTab(act: number, reset: boolean, fallbackScan?: () => number): number {
    if (act >= 0 && act < this.highlights.length) {
      const h = this.highlights[act]!
      if (h !== -1) {
        if (reset) {
          this.highlights.fill(-1)
        }
        return h
      }
    }
    return fallbackScan ? fallbackScan() : -1
  }

  /**
   * Open the Quest Log panel (`0x6face940` / `0x6facea8c`).
   * Transitions `alertState` (`1 -> 0 -> 2` or `0 -> 2`), sets `questPanelOpen = true` and `actTab = act0`,
   * and returns the initial `selectedQuestIdx` from `selectForActTab(act0, false)` (without clearing highlights;
   * the subsequent `S2C 0x52` reply clears them via `selectForActTab(actTab, true)`).
   * `fallbackScan` implements the binary's omitted icon-animation-flag scan (`0x6facda90`) so a fresh
   * open with no pending highlight selects the first started, unfinished quest of the act.
   */
  openQuestLog(act0: number, fallbackScan?: () => number): number {
    if (this.alertState === 1) {
      this.alertVisible = false
      this.alertPressed = false
      this.alertState = 0
    }
    this.alertState = 2
    this.questPanelOpen = true
    this.actTab = act0
    return this.selectForActTab(act0, false, fallbackScan)
  }

  /**
   * Close the Quest Log panel (`0x6face7e0`).
   */
  closeQuestLog(): void {
    this.questPanelOpen = false
    if (this.alertState === 2) {
      this.alertState = 0
      this.alertPressed = false
    }
  }

  /**
   * Click an Act tab inside the open Quest Log panel (`0x6facddf0`).
   * `fallbackScan` mirrors the binary's `0x6facda90` icon-animation-flag scan: switching to a tab
   * with no pending highlight selects the tab's first started, unfinished quest.
   */
  selectActTab(act0: number, fallbackScan?: () => number): number {
    this.actTab = act0
    return this.selectForActTab(act0, true, fallbackScan)
  }

  /**
   * Mouse-down on UI `0x11` (`0x6facdd90`).
   * When `inside` is true, sets `alertPressed = true` and returns `true` (caller plays sound 4 and consumes the event).
   * When `inside` is false, clears `alertPressed = false` and returns `false`.
   */
  pressAlert(inside: boolean): boolean {
    if (inside) {
      this.alertPressed = true
      return true
    }
    this.alertPressed = false
    return false
  }

  /**
   * Mouse-up on UI `0x11` (`0x6facf900`).
   * When `inside && alertPressed`, hides the alert button (`alertVisible = false`), clears `alertPressed`,
   * and returns `true` so the caller opens the Quest Log (`0x6face940`).
   */
  releaseAlert(inside: boolean): boolean {
    if (inside && this.alertPressed) {
      this.alertVisible = false
      if (this.alertState === 1) {
        this.alertState = 0
      }
      this.alertPressed = false
      return true
    }
    this.alertPressed = false
    return false
  }

  /**
   * Player death/corpse check in UI `0x11` draw (`0x6face5f0` -> `0x6face606`):
   * when the alert is active and the player is dead/dying, hide the alert and reset `alertState === 1`.
   */
  notePlayerDead(): void {
    if (!this.alertVisible && this.alertState !== 1) return
    this.alertVisible = false
    if (this.alertState === 1) {
      this.alertPressed = false
      this.alertState = 0
    }
  }

  reset(): void {
    this.statusBytes.fill(0)
    this.alertState = 0
    this.alertVisible = false
    this.alertPressed = false
    this.highlights.fill(-1)
    this.den = 0
    this.tombOffset = 0
    this.barbs = 0
    this.questPanelOpen = false
    this.actTab = 0
    this.selectRequest = null
    this.selectSeq = 0
  }
}
