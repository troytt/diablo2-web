/**
 * D2Client.dll 1.13c UI open/close policy (`UI\ui.cpp`).
 *
 * `SetUIState(ui, state)` (`0x6FB72790`, state 0 = open, 1 = close, 2 = toggle) keeps one open flag per
 * UI in `0x6FBAAD80[38]`. Before a UI is opened (state 0, or state 2 while closed) `0x6FB71A80` walks
 * every currently-open UI `i` and applies `UI_POLICY_113C[i][new]` via the jump table `0x6FB71C20`:
 *
 *   0 = coexist, 1 = close the open UI `i` (`SetUIState(i, 1)`), 2 = refuse to open `new`,
 *   3 = refuse to open `new` (asserts when `new == 0`), 4 = cancel the NPC interaction (`0x6FAF7B20`).
 *
 * Closing never consults the matrix. Rows come verbatim from the descriptors `0x6FB8D538[38]`
 * (`0x98` bytes each, first 38 DWORDs = this row). Rows 0, 19 and 35 live in `.bss` (filled at
 * runtime) and are not reproduced; none of them is a UI the web client models.
 *
 * UI ids verified from the hotkey handlers that read/write `0x6FBAAD80 + 4 * id`:
 * inventory 1 (`0x6FAEC2A0`), character 2 (`0x6FAEC5B0`), skill speed bar 3 (`0x6FAEB470`),
 * skill tree 4 (`0x6FAEB5B0`), chat 5, NPC menu 8, game menu 9, automap 0x0A (`0x6FAEB8B0`),
 * NPC shop 0x0C, show items 0x0D (`0x6FAEB230`), anvil/imbue window 0x0E, quest log 0x0F (`0x6FACE940`),
 * waypoint 0x14 (handlers `0x6FB5A4E0`/`0x6FB5A740`), party 0x16 (`0x6FAEBFC0`), trade 0x17,
 * message log 0x18 (`0x6FAEBEB0`), stash 0x19, cube 0x1A, belt 0x1F (`0x6FAEB300`),
 * help 0x21 (`0x6FAEBA70`), hireling 0x24 (`0x6FAEAEE0`).
 */

export const UI_113C = {
  inventory: 0x01,
  character: 0x02,
  skillSpeedBar: 0x03,
  skillTree: 0x04,
  chat: 0x05,
  npcMenu: 0x08,
  gameMenu: 0x09,
  automap: 0x0a,
  npcShop: 0x0c,
  showItems: 0x0d,
  anvil: 0x0e,
  questLog: 0x0f,
  waypoint: 0x14,
  party: 0x16,
  trade: 0x17,
  messageLog: 0x18,
  stash: 0x19,
  cube: 0x1a,
  belt: 0x1f,
  help: 0x21,
  hireling: 0x24,
} as const

export type UiId113c = (typeof UI_113C)[keyof typeof UI_113C]

/** Raw policy rows (`desc[open]`), one digit per target UI 0..37. `null` = `.bss` row. */
const RAW_ROWS: readonly (string | null)[] = [
  null, // 0
  '02011000110330101010000111111110101000', // 1 inventory
  '00210000110110111010101111111110100011', // 2 character
  '01121101100110111010100111111111111011', // 3 skill speed bar
  '01012000110110100010000111111110111001', // 4 skill tree
  '01222200110110110010120101111112100000', // 5 chat
  '00000000000000000000000000000000110000', // 6
  '00000000000000000000000000000000111000', // 7
  '02222000320202322030333323333330222022', // 8 NPC menu
  '02222200122222122010102121111111121021', // 9 game menu
  '00000000003100000010000000011110100000', // 10 automap
  '02222222322232333010233121111111122021', // 11
  '00222000020030020030202323333330222021', // 12 NPC shop
  '00000000000000000000000000000000100000', // 13 show items
  '02222200420000020000222323333332222020', // 14 anvil
  '00110100410110131200101111111110110011', // 15 quest log
  '00110100100010113010111111111110111011', // 16
  '00000000000100110300000010011110100000', // 17
  '03333300433330320030222321111113222031', // 18
  null, // 19
  '01111100110130311010311111111110111011', // 20 waypoint
  '00000000000100001010000000000000100000', // 21
  '00110000110130311010100111111110110011', // 22 party
  '02222000222230322020202323333330322022', // 23 trade
  '01111000110110111010101121111111111011', // 24 message log
  '02222000322230321010202323333330322021', // 25 stash
  '02222000312230321010202323333330122021', // 26 cube
  '02222200312230322010202323333331122021', // 27
  '02222200312230322010202323333330122021', // 28
  '02222200312230322010202323333330122021', // 29
  '02222200312230322010202323333331122021', // 30
  '00011100110210000010000000030033100000', // 31 belt
  '02222200312230322010202323333331100021', // 32
  '22222222122212122222102121111111111021', // 33 help
  '00000000000000100000100101111110112000', // 34
  null, // 35
  '00110000110110111010101111111110100021', // 36 hireling
  '00111000110110111010101111111110100012', // 37
]

export const UI_POLICY_COEXIST = 0
export const UI_POLICY_CLOSE_OPEN = 1
export const UI_POLICY_REFUSE = 2
export const UI_POLICY_REFUSE_ASSERT = 3
export const UI_POLICY_CANCEL_NPC = 4

/** `desc[openUi][newUi]` from `0x6FB8D538`. */
export function uiPolicy113c(openUi: number, newUi: number): number {
  const row = RAW_ROWS[openUi]
  if (row === undefined || row === null) {
    throw new Error(`D2Client.dll UI policy row ${openUi} is not available`)
  }
  const ch = row[newUi]
  if (ch === undefined) throw new Error(`D2Client.dll UI id ${newUi} out of range`)
  return ch.charCodeAt(0) - 48
}

export interface UiOpenDecision {
  readonly allowed: boolean
  /** Open UIs that must be closed before `newUi` opens (policy 1). */
  readonly close: readonly number[]
  /** Whether the NPC interaction must be cancelled (policy 4). */
  readonly cancelNpc: boolean
}

/**
 * Replays `0x6FB71A80` for opening `newUi` while `openUis` are open. Mirrors the in-order walk:
 * a refusal (2/3) aborts immediately, after any earlier closes/cancels have already been applied.
 */
export function decideUiOpen113c(openUis: Iterable<number>, newUi: number): UiOpenDecision {
  const close: number[] = []
  let cancelNpc = false
  const sorted = [...new Set(openUis)].filter((u) => u !== newUi).sort((a, b) => a - b)
  for (const open of sorted) {
    const p = uiPolicy113c(open, newUi)
    if (p === UI_POLICY_REFUSE || p === UI_POLICY_REFUSE_ASSERT) {
      return { allowed: false, close, cancelNpc }
    }
    if (p === UI_POLICY_CLOSE_OPEN) close.push(open)
    else if (p === UI_POLICY_CANCEL_NPC) cancelNpc = true
  }
  return { allowed: true, close, cancelNpc }
}
