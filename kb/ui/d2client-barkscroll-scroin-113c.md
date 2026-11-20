# D2Client.dll 1.13c — Scroll of Inifuss / Key to the Cairn Stones (`scroin.dc6`, `scroin2.dc6`, `scroin3.dc6`)

Source: `samples/d2/D2Client.dll` (1.13c, image base `0x6fab0000`) and `samples/d2/D2Gdi.dll` (`0x6f870000`), disassembled with `objdump -d -M intel`.
Found while fixing Issue #1622 (deciphered Scroll of Inifuss glow and rune number offsets).

## 1. Entry Points & Packet Handshake

- **`0x6fb2c9f0` (`BARKSCROLL_OpenUndeciphered`, item code `'bks '`)**:
  - Resets `ds:0x6fbc3b07 = 0` (`barkscrollAnimFrame`).
  - Records `ds:0x6fbc3afc = pItem->dwUnitId`.
  - Enables UI `0x10` (`UI_BARKSCROLL`) and plays sound `0xa6e` (`2670`, `cursor_read_scroll`).
- **`0x6fb2cf10` (`BARKSCROLL_OpenDeciphered`, item code `'bkd '`)**:
  - Sets `ds:0x6fbc3b14 = 1` (awaiting `S2C 0x50` type 4).
  - Records `ds:0x6fbc3afc = pItem->dwUnitId`.
  - Sends `C2S 0x3E` (`SelectMainItem`, 5 bytes: `[0x3E, u32 itemId]`) via `0x6fb2f200`.
  - Enables UI `0x10` (`UI_BARKSCROLL`).
- **`0x6fb2cf50` (`BARKSCROLL_Recv0x50Type4`, called when `S2C 0x50` `words[0] == 4`)**:
  - Copies the 5 Cairn Stone indices (`0..4`, representing `Objects.txt` `17..21` `StoneAlpha`..`StoneLambda` minus `0x11` from `D2Game.dll` `0x6fc84830..0x6fc84848`) into `WORD ds:0x6fbc3950[0..4]`.
  - Clears `ds:0x6fbc3b14 = 0`, resets `ds:0x6fbc3b07 = 0` (`animTick`) and `ds:0x6fbc3b03 = 0` (`lastTickMs`), and plays sound `0xa6e` (`2670`).
- **`0x6fb2de00` (`BARKSCROLL_Main`)**:
  - Looks up item `ds:0x6fbc3afc` on the player.
  - If item code is `'bks '` (`0x20736b62`), calls `0x6fb2cc60(0)`.
  - If item code is `'bkd '` (`0x20646b62`):
    - While `ds:0x6fbc3b14 != 0`, calls `0x6fb2c380()` (background only).
    - Once `ds:0x6fbc3b14 == 0`, calls `0x6fb2cc60(1)`.

## 2. Background & Close Button (`0x6fb2c380`)

- Draws the 4-frame `data\global\ui\MENU\scroin.dc6` (`320×432` total) at left-dock panel origin `(ox, oy)` (`ox = ds:0x6fbcb9a0 = 80`, `oy = -ds:0x6fbcb9a4 = 60` in `800×600`):
  - Frame 0 (`256×256`) at `(ox, oy + 256)`
  - Frame 1 (`64×256`) at `(ox + 256, oy + 256)`
  - Frame 2 (`256×176`) at `(ox, oy + 432)`
  - Frame 3 (`64×176`) at `(ox + 256, oy + 432)`
- Draws the close button (`buysellbtn.dc6` frame 10 raised / 11 pressed) at `(ox + 277, oy + 387)` (`nYpos = oy + 419` bottom-left).

## 3. Deciphered Rune Numbers & Glow (`0x6fb2cc60`)

```
6fb2cc60: push ebp ; mov ebp, esp ; and esp, -8 ; sub esp, 0x1a4   ; stdcall, 1 arg (ret 4 at 0x6fb2cecc)
...
6fb2cc89: call 0x6fb2c380                                         ; background + close button
...
6fb2cd3a: mov  eax, [ebp+8]  ; bDeciphered
6fb2cd3d: test eax, eax
6fb2cd3f: je   0x6fb2cec6    ; Undeciphered ('bks') jumps to the epilogue (pop edi/esi/ebx; ret 4)
```

When `bDeciphered == 0` (`bks`), neither `scroin2.dc6` nor `scroin3.dc6` is drawn; only the `scroin.dc6` parchment with its 5 painted Cairn Stone symbols is shown.

When `bDeciphered != 0` (`bkd`):
1. **Tick Timer (`0x6fb2cd59..0x6fb2cd9f`)**:
   - Uses `ds:0x6fbc3b03` (`lastTickMs`) and `ds:0x6fbc3b07` (`animTick`).
   - Every `50ms` (`add ecx, 0x32; cmp ecx, eax; jae 0x6fb2cd9f` at `0x6fb2cd8b`), updates `ds:0x6fbc3b03 = GetTickCount()` and increments `ds:0x6fbc3b07` (`animTick`) by 1 (`0x6fb2cd99`).
   - `animTick` increases monotonically while the scroll remains open (never wraps back to 0), keeping the revealed numbers `1..5` permanently visible after their glow animations finish.
2. **Step Loop (`for stepIdx = 0..4`, `0x6fb2cdb0..0x6fb2ceb5`)**:
   - Reads `threshold = DWORD PTR [stepIdx*4 + 0x6fb91c90]` = `[0, 12, 24, 36, 48]`.
   - When `animTick > threshold`:
     - `delta = animTick - threshold` (`>= 1`).
     - If `delta == 1`, plays sound `0xa6f` (`2671`).
     - `stoneIdx = WORD PTR [stepIdx*2 + 0x6fbc3950]` (`cairnStoneOrder[stepIdx]`, `0..4`).
     - **Rune Number (`scroin2.dc6`, `0x6fb2cdd5..0x6fb2ce51`)**:
       - Selects frame `stepIdx` (`0..4`, corresponding to numerals `1..5`).
       - Draws at `nXpos = ox + BARKSCROLL_RUNE_POS[stoneIdx].x`, `nYpos = oy + BARKSCROLL_RUNE_POS[stoneIdx].y`.
       - Because `scroin2.dc6` frames have `height = 25, offsetX = 0, offsetY = 0`, `D2Gdi.dll` `0x6f8765e0` places top-left at `(ox + pos.x, oy + pos.y - 25)`.
       - Fade-in `eDrawMode` (`0x6fb2cdeb..0x6fb2ce0a`):
         - `delta < 5`: `eDrawMode = 0` (25% alpha)
         - `5 <= delta < 10`: `eDrawMode = 1` (50% alpha)
         - `10 <= delta < 15`: `eDrawMode = 2` (75% alpha)
         - `delta >= 15`: `eDrawMode = 5` (100% opaque)
     - **Starburst Glow (`scroin3.dc6`, `0x6fb2ce56..0x6fb2cea6`)**:
       - Uses `cmp esi, 0x15; setge al; dec eax; and eax, esi` (`0x6fb2ce5e..0x6fb2ce97`) to set `CellContext.nFrame = (delta >= 21) ? 0 : delta`. Frame `0` in `scroin3.dc6` is an empty `2×2` transparent cell, while frames `1..20` are the 20 glow frames.
       - Draws at `nXpos = ox + BARKSCROLL_GLOW_POS[stoneIdx].x`, `nYpos = oy + BARKSCROLL_GLOW_POS[stoneIdx].y` with `eDrawMode = 3` (`DRAWMODE_MODULATE` / canvas `'screen'`).
       - In `D2Gdi.dll` `0x6f8765e0`, each DC6 frame is placed at `(nXpos + f.offsetX, nYpos + f.offsetY - f.height)`. Since `src/baker/packers/pack-ui.ts` packs `scroin3.dc6` frames `1..20` into `120×160` cells at `(150 + f.offsetX, 88 - f.height + f.offsetY)`, blitting cell `delta - 1` at `(ox + glowPos.x - 150, oy + glowPos.y - 88)` reproduces `(ox + glowPos.x + f.offsetX, oy + glowPos.y + f.offsetY - f.height)` to the exact pixel.

## 4. `.rdata` Coordinate Tables (`0x6fb91c40..0x6fb91ca0`)

| Stone Index | Object (`Objects.txt`) | Medallion Position | `BARKSCROLL_RUNE_POS` (`0x6fb91c40`) | `BARKSCROLL_GLOW_POS` (`0x6fb91c68`) | Glow Center (`glowPos + (-95, -29)`) |
| --- | --- | --- | --- | --- | --- |
| `0` | `17` (`StoneAlpha`) | Top-Right | `{ x: 242, y: 104 }` (`0xf2, 0x68`) | `{ x: 303, y: 161 }` (`0x12f, 0xa1`) | `(208, 132)` |
| `1` | `18` (`StoneBeta`) | Middle-Right | `{ x: 255, y: 222 }` (`0xff, 0xde`) | `{ x: 322, y: 242 }` (`0x142, 0xf2`) | `(227, 213)` |
| `2` | `19` (`StoneGamma`) | Bottom-Center | `{ x: 148, y: 310 }` (`0x94, 0x136`) | `{ x: 254, y: 290 }` (`0xfe, 0x122`) | `(159, 261)` |
| `3` | `20` (`StoneDelta`) | Middle-Left | `{ x: 47, y: 222 }` (`0x2f, 0xde`) | `{ x: 190, y: 238 }` (`0xbe, 0xee`) | `(95, 209)` |
| `4` | `21` (`StoneLambda`) | Top-Left | `{ x: 75, y: 104 }` (`0x4b, 0x68`) | `{ x: 211, y: 162 }` (`0xd3, 0xa2`) | `(116, 133)` |

- `BARKSCROLL_STEP_THRESHOLDS` (`0x6fb91c90..0x6fb91ca0`): `[0, 12, 24, 36, 48]`.
