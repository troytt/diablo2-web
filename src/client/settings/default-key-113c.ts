/**
 * Diablo II 1.13c default key configuration (`default.key` in the game directory).
 *
 * D2Client.dll keeps the live binding table at `0x6FBCA2E0` as 114 records of
 * `{ DWORD cmdId; WORD vk; DWORD slot; }` (57 commands x primary/secondary), dispatched by
 * `0x6FAE8BB0` (keydown) / `0x6FAE8AD0` (keyup) into the command handler table
 * `0x6FBA4F10` = `{ fnDown; fnUp; dwAllowInModal; }[57]`. `CmdTbl.cpp` `0x6FAE9910` reads the first
 * `0x47A` bytes of `default.key` (6-byte header `'WS'`, version `0x25`, size `0x47A`, then the 114
 * records; `0x6FAE9A60` writes the same layout). Per-character `<name>.key` files are read by
 * `0x6FAEA730` (`WORD 0x25` + the same 114 records, `0x476` bytes).
 *
 * `DEFAULT_KEY_113C[cmdId] = [primaryVk, secondaryVk]` is the verbatim content of the shipped
 * `default.key` (verified record-by-record against the file in `tests/default-key-113c.test.ts`).
 * `VK_NONE` (`0xFFFF`) marks an unbound slot.
 */

export const VK_NONE = 0xffff

/** Command ids of the D2Client.dll command handler table `0x6FBA4F10` (handler address in comments). */
export const D2_CMD = {
  characterScreen: 0, // 0x6FAEC5B0
  inventoryScreen: 1, // 0x6FAEC2A0
  partyScreen: 2, // 0x6FAEBFC0
  messageLog: 3, // 0x6FAEBEB0
  questLog: 4, // 0x6FAEC8C0
  chat: 5, // 0x6FAEBC10
  helpScreen: 6, // 0x6FAEBA70
  automap: 7, // 0x6FAEB8B0
  centerAutomap: 8, // 0x6FAEA690 -> 0x6FB108D0(1)
  fadeAutomap: 9, // 0x6FAE9E20 ("AutoMapFade")
  partyOnAutomap: 10, // 0x6FAE9DF0 ("AutoMap Party")
  namesOnAutomap: 11, // 0x6FAE9DC0 ("AutoMap Party Names")
  skillTree: 12, // 0x6FAEB5B0
  skillSpeedBar: 13, // 0x6FAEB470
  selectSkill1: 14, // 0x6FAEADB0 .. selectSkill8 = 21 (0x6FAEABF0)
  showBelt: 22, // 0x6FAEB300
  useBeltSlot1: 23, // 0x6FAEC9A0 .. useBeltSlot4 = 26 (0x6FAEC8E0)
  sayHelp: 27, // 0x6FAE9D60 (C2S 0x3F phrase 0x19) .. say7 = 33 (0x6FAE9CA0, phrase 0x1F)
  run: 34, // 0x6FAEAE40 / 0x6FAEADF0
  toggleRunWalk: 35, // 0x6FAE9C60
  standStill: 36, // 0x6FAE9C50 / 0x6FAE9C20
  showItems: 37, // 0x6FAEB230 / 0x6FAEAEA0
  clearScreen: 38, // 0x6FAEA900 -> 0x6FAF3870
  selectPreviousSkill: 39, // 0x6FAEA8E0
  selectNextSkill: 40, // 0x6FAEA8C0
  clearMessages: 41, // 0x6FAE9C30
  screenshot: 42, // keyup 0x6FABD420
  showPortraits: 43, // 0x6FB0C3D0
  swapWeapons: 44, // 0x6FAEA9C0
  toggleMiniMap: 45, // 0x6FAE9D80 ("AutoMap Left")
  selectSkill9: 46, // 0x6FAEABB0 .. selectSkill16 = 53 (0x6FAEA9F0)
  hirelingScreen: 54, // 0x6FAEAEE0
  sayRetreat: 55, // 0x6FAE9C80 (C2S 0x3F phrase 0x20)
  gameMenu: 56, // 0x6FAEC880
} as const

/** Verbatim `default.key` records, indexed by command id: `[primaryVk, secondaryVk]`. */
export const DEFAULT_KEY_113C: readonly (readonly [number, number])[] = [
  [0x41, 0x43], // 0  A / C
  [0x49, 0x42], // 1  I / B
  [0x50, VK_NONE], // 2  P
  [0x4d, VK_NONE], // 3  M
  [0x51, VK_NONE], // 4  Q
  [0x0d, VK_NONE], // 5  Enter
  [0x48, VK_NONE], // 6  H
  [0x09, 0x100], // 7  Tab / mouse pseudo-key 0x100
  [0x78, VK_NONE], // 8  F9
  [0x79, VK_NONE], // 9  F10
  [0x7a, VK_NONE], // 10 F11
  [0x7b, VK_NONE], // 11 F12
  [0x54, VK_NONE], // 12 T
  [0x53, VK_NONE], // 13 S
  [0x70, VK_NONE], // 14 F1
  [0x71, VK_NONE], // 15 F2
  [0x72, VK_NONE], // 16 F3
  [0x73, VK_NONE], // 17 F4
  [0x74, VK_NONE], // 18 F5
  [0x75, VK_NONE], // 19 F6
  [0x76, VK_NONE], // 20 F7
  [0x77, VK_NONE], // 21 F8
  [0xc0, VK_NONE], // 22 `
  [0x31, VK_NONE], // 23 1
  [0x32, VK_NONE], // 24 2
  [0x33, VK_NONE], // 25 3
  [0x34, VK_NONE], // 26 4
  [0x60, VK_NONE], // 27 Num0
  [0x61, VK_NONE], // 28 Num1
  [0x62, VK_NONE], // 29 Num2
  [0x63, VK_NONE], // 30 Num3
  [0x64, VK_NONE], // 31 Num4
  [0x65, VK_NONE], // 32 Num5
  [0x66, VK_NONE], // 33 Num6
  [VK_NONE, VK_NONE], // 34 (Run: unbound)
  [0x52, 0x102], // 35 R / mouse pseudo-key 0x102
  [0x10, VK_NONE], // 36 Shift
  [0x12, 0x101], // 37 Alt / mouse pseudo-key 0x101
  [0x20, VK_NONE], // 38 Space
  [0x103, VK_NONE], // 39 mouse wheel up
  [0x104, VK_NONE], // 40 mouse wheel down
  [0x4e, VK_NONE], // 41 N
  [0x2c, VK_NONE], // 42 PrintScreen
  [0x5a, VK_NONE], // 43 Z
  [0x57, VK_NONE], // 44 W
  [0x56, VK_NONE], // 45 V
  [VK_NONE, VK_NONE], // 46 (Skill 9: unbound)
  [VK_NONE, VK_NONE], // 47
  [VK_NONE, VK_NONE], // 48
  [VK_NONE, VK_NONE], // 49
  [VK_NONE, VK_NONE], // 50
  [VK_NONE, VK_NONE], // 51
  [VK_NONE, VK_NONE], // 52
  [VK_NONE, VK_NONE], // 53 (Skill 16: unbound)
  [0x4f, VK_NONE], // 54 O
  [0x67, VK_NONE], // 55 Num7
  [0x1b, VK_NONE], // 56 Esc
]

/**
 * Maps a Win32 virtual-key code from `default.key` to the web binding code
 * (`KeyboardEvent.code`, the generic modifier names `Shift`/`Alt`/`Control`, or `WheelUp`/`WheelDown`).
 *
 * Returns `null` for `VK_NONE` and for the mouse pseudo-keys `0x100..0x102`, whose button
 * assignment has not been reverse-engineered yet (they are left unbound rather than guessed).
 */
export function vkToBindingCode(vk: number): string | null {
  if (vk === VK_NONE) return null
  if (vk >= 0x41 && vk <= 0x5a) return `Key${String.fromCharCode(vk)}`
  if (vk >= 0x30 && vk <= 0x39) return `Digit${String.fromCharCode(vk)}`
  if (vk >= 0x60 && vk <= 0x69) return `Numpad${vk - 0x60}`
  if (vk >= 0x70 && vk <= 0x87) return `F${vk - 0x6f}`
  switch (vk) {
    case 0x09:
      return 'Tab'
    case 0x0d:
      return 'Enter'
    case 0x10:
      return 'Shift'
    case 0x11:
      return 'Control'
    case 0x12:
      return 'Alt'
    case 0x1b:
      return 'Escape'
    case 0x20:
      return 'Space'
    case 0x2c:
      return 'PrintScreen'
    case 0xc0:
      return 'Backquote'
    case 0x103:
      return 'WheelUp'
    case 0x104:
      return 'WheelDown'
    default:
      return null
  }
}

/** Default web binding codes `[primary, secondary]` for a D2Client.dll command id. */
export function defaultBindingCodesForCommand(cmdId: number): readonly [string | null, string | null] {
  const rec = DEFAULT_KEY_113C[cmdId]
  if (!rec) throw new Error(`default.key has no record for command ${cmdId}`)
  return [vkToBindingCode(rec[0]), vkToBindingCode(rec[1])]
}
