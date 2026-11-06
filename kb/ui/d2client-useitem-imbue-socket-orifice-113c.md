# Diablo II v1.13c `UI\useitem.cpp`: Charsi Imbue / Larzuk Add Sockets / Anya Personalize / Horadric Orifice

## Overview
All four "put one item in the box" windows are a single D2Client module, `..\Source\D2Client\UI\useitem.cpp`
(string at `0x6fb84538`), code range `0x6fb4f400..0x6fb50480`. A global mode selects the flavour:

| `0x6fbbb210` (mode) | Opened by | Inset DC6 | Confirm action |
|---|---|---|---|
| `0` | S2C `0x58 OpenUi` uiAction `0` (`0x6fb50264`, unitId = orifice object) | `data\global\ui\MENU\horadricback.dc6` (119x184) | C2S `0x44` (17 bytes) via `0x6fb4f8dc` |
| `1` | NPC menu (`0x6fb50230`, stores `0x6fbbb218`) | `data\global\ui\MENU\upgrade.dc6` (119x184) | C2S `0x38` NpcEntityAction (`0x6faf5fb0`) |

Mode-1 behaviour is keyed on the interacting NPC class (`0x6fbc9725`): `0x9a` = 154 Charsi, `0x1ff` = 511 Larzuk,
`0x200` = 512 Anya (`drehya`). The item-eligibility checks at `0x6fb50407..0x6fb50447` call D2Common via
`0x6fabc7cc` (Charsi), `0x6fabc7d2` (Larzuk), `0x6fabc7c6` (Anya); mode 0 requires `dwCode == 'hst '`
(`0x6fb50466`). A rejected item calls `0x6fb38a70` with `ebx = 3` (`0x6fb50449..0x6fb50456`).

Cell files are loaded in `0x6fb4f750` (`menu\upgrade` -> `0x6fbcbc0c`, `menu\horadricback` -> `0x6fbcbc10`);
`panel\buysellbtn` is lazily loaded into `0x6fbcb9c4` by the draw routine.

## Coordinates are absolute (no 800x600 offset)
`useitem.cpp` draws and hit-tests with literal constants. Unlike the `inventory.txt`-driven panels (e.g. the
vendor draw at `0x6fb45ca0`, which adds `0x6fbcb9a0` / `0x6fbcb9a4` / screen height), nothing here adds a panel
offset, and the draw caller (`0x6fb73d7e`, gated by `0x6fbaadb8`) sets none either. The window therefore sits
at the same screen pixels in 640x480 and 800x600.

## Draw (`0x6fb4f460`, item `0x6fb4fb00`)
- Font: D2Win `#10184` SetFont(1) = font16 for everything; restored at the end.
- Inset: D2GFX `#10041` DrawCellContextEx(cell, x = `0x69`, y = `0x10e`, -1, mode 5) -> bottom-left anchored,
  i.e. top-left `(105, 86)`, size 119x184.
- Buttons: `.data 0x6fb8ec60` table, stride `0x28`, count `0x6fb8ecb0` = 2, drawn from `buysellbtn.dc6`
  with frame `base + pressed`:

  | # | string id (hover) | draw (bottom-left) | hit rect | frame |
  |---|---|---|---|---|
  | 0 | `0x0fb1` (overridden, see below) | `(122, 256)` | `[122..154] x [224..256]` | 16 (checkmark) |
  | 1 | `0x102f` = 4143 `close` | `(177, 256)` | `[177..209] x [224..256]` | 10 (close) |

  Button 0 label: mode 0 -> `0xd49` = 3401 `ok`; mode 1 -> 4017 `imbue` (Charsi), `0x58dc` = 22748
  `add sockets` (Larzuk), `0x58dd` = 22749 `personalize` (Anya).
- Hover label (`0x6fb4f54b..0x6fb4f659`, only when mouse x < 320 and y < screenH - 48): `w` = D2Win `#10028`
  text width, `fh` = D2Win `#10083` font height (returns `tbl[+0x0a]` = nHeight). D2GFX `#10014`
  DrawRectangle(`x1 = drawX - w/2 + 10`, `y1 = drawY - fh - 42`, `x1 + w + 12`, `y1 + fh + 6`, color 0,
  DRAWMODE_TRANS75), then D2Win `#10150` DrawText(label, `drawX - w/2 + 16`, `drawY - 38`, color 0 white).
- Mode-1 instruction text (`0x6fb4f67a..0x6fb4f718`): string `0x275c` = 10076 (`upgraderestrictEx`,
  patchstring #76, "No Magic, Socketed, Rare, Unique, or Set Items. No Jewelry.") for Charsi,
  `0x58de` = 22750 (expansionstring #2750) for Larzuk, `0x58db` = 22747 (expansionstring #2747) for Anya.
  Wrapped by D2Win `#10059` at width `0x12c` = 300; line `n` drawn color 4 (gold) at
  `x = 160 - w/2`, baseline `y = 30 + 20 n`. Mode 0 draws no text.
- Placed item (`0x6fb4fbf2..0x6fb4fc18`, state 2 only): inventory graphic drawn 1:1 at
  `x = 0xa7 - (w >> 1)`, `y = 0x6a + (h < 0x70 ? (0x72 - h) >> 1 : 0)`.
- There is no 320x432 panel background, no title, no item-name text and no [X] close button.

## Input
- `.data 0x6fb8ecb8` message table: `WM_LBUTTONUP 0x202 -> 0x6fb4ff10`, `WM_LBUTTONDOWN 0x201 -> 0x6fb50320`,
  `0x204 -> 0x6fb50320`, `0x205 -> 0x6fb4ff10`, `WM_MOUSEMOVE 0x200 -> 0x6fb4fc50`, keys ESC `0x1b` and
  SPACE `0x20` -> `0x6fb4fc80` (cancel).
- Mouse down (`0x6fb50320`, 400 ms debounce via `0x6fbbb228`) sets the button's pressed byte (`0x6fb4f7b0`);
  mouse up (`0x6fb4fe50`) fires button 0 -> `0x6fb4f830` (confirm, shows a 150x130 "Waiting for confirmation
  of transaction..." dialog, string 3353) or button 1 -> `0x6fb4fd70` (close; returns the item).
- Item drop/pick rect: `[0x7b..0xd3] x [0x6a..0xdc]` = `[123..211] x [106..220]`.

## S2C `0x58` dispatch (`0x6fb50250`, jump table `0x6fb50300`)
uiAction 0 -> open orifice (mode 0); 1 -> close; 2, 3 -> invalid (assert); 4 -> state 2 + destroy wait dialog;
5 -> sound (`extra ? 5 : 3`) + close; 6, 7 -> close + `0x6faf8150`.

## Web port
`src/client/ui/world-panels.ts` `USE_ITEM_LAYOUT`, `drawUseItemPanel`, `hitTestUseItemButton`,
`hitTestUseItemSlot`; strings are emitted by `src/baker/packers/pack-canonical-tbl.ts` under index aliases
(`patchstring#76`, `string#3401`, `string#4017`, `string#4143`, `expansionstring#2747..2750`); the inset is
baked by `src/baker/packers/pack-ui.ts` as `/ui/upgrade.png` (`BAKED_UI_MANIFEST.images.upgradeBg`).
