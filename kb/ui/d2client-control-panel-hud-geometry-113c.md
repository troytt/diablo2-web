# D2Client 1.13c — bottom control panel HUD geometry (exp bar, stamina bar, run/menu buttons, mini panel, skill buttons, belt pop-up)

Source: `D2Client.dll` 1.13c (image base `0x6FAB0000`). `W`/`H` = screen width/height globals
(`0x6FB8BC48` / `0x6FB8BC4C`). All DC6 cells are drawn with `D2gfx #10041` (DrawCellContext) where the
passed `y` is the **bottom** edge (`top = y - frameHeight`; all frames below have `offsetY = 0`).
Solid rects use `D2gfx #10014(x1, y1, x2, y2, paletteIndex, drawMode)`, lines `D2gfx #10010`.

## HUD draw order (`0x6FAD9294..0x6FAD92C1`)
`0x6FAD7290` control panel → `0x6FAD7BD0` life globe → `0x6FAD7A90` mana globe → `0x6FAD6970` exp bar →
`0x6FAD8320` run button → `0x6FAD78B0` stamina bar → `0x6FAD6880` mini-panel toggle → `0x6FAD8DC0` skill
buttons → `0x6FAD8CE0` → `0x6FAD89A0`. `0x6FAD70D0`/`0x6FAD71C0` draw `Panel\800BorderFrame` first when a
side panel is open at 800x600.

## Control panel (`0x6FAD7290`)
- 800x600 (`D2gfx #10031 == 2`): `Panel\800CtrlPnl7.dc6` frames **0..5 only**: f0 `x=0`, f1 `W/2-235`,
  f2 `W/2-107`, f3 `W/2+21`, f4 `W/2+149`, f5 `W-117`; bottom `y=H` (frames 0/5 use `H-ebx`, `ebx=1` only when
  `D2gfx #10078 == 3`). Frame 6 (128x55) is **never drawn**; the gaps `117..165` and `635..683` are the
  skill-button wells.
- 640x480: `Panel\CtrlPnl7.dc6` frames 0..4: f0 `x=0`, f1 `W/2-155`, f2 `W/2-27`, f3 `W/2+101`, f4 `W-117`.

## Experience bar (`0x6FAD6970`)
- `lvl = #10973(unit, 12)`, `xp = #10973(unit, 13)`; `next = #10399(class, baseLevel)`,
  `prev = #10399(class, lvl-1)`; `span = next - prev`, `into = max(0, xp - prev)`.
- `fill = into * 119 / span` (both operands `>> 7` when `into >= 0x226B902`); `fill > 119 → 0`.
- Skipped entirely when `lvl >= #10066(class)` (max level) or `fill == 0`.
- Drawn as **two 1-px lines** (`#10010`, palette `0xFF`, alpha `0xFF`) from `x=W/2-144` to `W/2-144+fill`
  at `y=H-38` and `y=H-37` (800: `256..375`, `y=562/563`; 640: `176..295`, `y=442/443`). No backdrop, no ticks.
- Hover box `x∈[W/2-146, W/2-23]`, `y∈[H-43, H-34]` → string `0x1043` (`panelexp`) formatted `(xp, next)`
  drawn by `D2Win #10085` at `(W/2-146, H-51)`.

## Stamina bar (`0x6FAD78B0`)
- Palette indices cached once via `D2Win #10190(r,g,b)`: `RGB(255,0,0)` red, `RGB(244,192,76)` yellow,
  `RGB(0,0,255)` blue.
- `cur` = smoothed stamina (`0x6FAD6B20(10)`), `max = #10578(unit)` (fixed point `<<8`).
- Blue + full width when `cur > max + 5` or `#10866(unit, 0x18)` (`STATES_CheckStateMaskOnUnit`, mask 24 =
  States.txt `stambarblue`: `shrine_stamina` 136, `staminapot` 180).
- Else `w = cur * 102 / max`; `w < 25` → **red**, otherwise yellow.
- Rect `#10014(W/2-127, H-27, W/2-127+w, H-9, color, drawMode=2)` (translucent over the panel art).
- Hover `x∈[W/2-127, W/2-25]`, `y∈[H-27, H-9]` → string `0x1044` (`panelstamina`) `(cur>>8, max>>8)`; if
  `cur > max` **or** `#10494(unit, 136 shrine_stamina)` the current value is replaced by `max` and the
  text colour is 3 (blue). Drawn centered at `(W/2-76, H-52)`.

## Smoothed vitals (`0x6FAD6B20`, used by life 6 / mana 8 / stamina 10)
Per-stat record `0x6FBCA794 + i*16` `{target, tTarget, start, tStart}`, frame counter `0x6FBC97F8`:
- first frames: snap. Life (stat 6) decreasing: snap. `|Δ| >= max/8`: snap.
- small change: `start = (cur == max) ? cur : previousTarget`, duration = frames between the last two
  updates clamped to `7..15`; value = `start + (target-start) * (elapsed+1) / duration`, clamped `0..max`.

## Run button (`0x6FAD8320`) / mini-panel toggle (`0x6FAD6880`)
- `Panel\runbutton.dc6` (16x20): `x=W/2-145`, bottom `H-10` (top `H-30`: 800 → 570, 640 → 450). Frame
  `running ? 2 : 0` (+1 while pressed). Hit `x∈[W/2-145, W/2-128]`, `y∈[H-28, H-8]` (`0x6FAD65A0`).
- `Panel\menubutton.dc6` (15x24): `x=W/2-8`, bottom `H-16` (top `H-40`: 800 → 560, 640 → 440).
  Frame `open ? 2 : 0` (+1 pressed). Hit `x∈[W/2-8, W/2+5]`, `y∈[H-39, H-13]`.

## Mini panel (`0x6FB13000` layout, `0x6FB13130`/`0x6FB14990` draw, `0x6FB14550` hit)
- `minipanel.dc6` (173x26, 8 buttons) when `0x6FBCC394` set, else `minipanel_s.dc6` (7 buttons).
- Placement mode from `0x6FB13880` (left panel open) / `0x6FB137B0` (right panel open):
  none → centered (mode 2); right only → mode 1 (shift left); left only → mode 3 (shift right);
  **both → hidden** (`0x6FBCC090 = 1`).
- Background top-left (bottom `H-47`, top `H-73`): mode 2 multi `W/2-87`, single `W/2-77`; mode 1 `W/2-205`;
  mode 3 multi `W/2+33`, single `W/2+54`.
- Buttons (`minipanelbtn.dc6` 20x20): first `x` = mode 2 multi `W/2-84`, single `W/2-74`; mode 1 `W/2-202`;
  mode 3 multi `W/2+35`, single `W/2+57`; **step 21 px**; bottom `H-50` (top `H-70`). 800 centered multi:
  bg `(313, 527)`, buttons `x = 316 + 21*i`, top `530`.
- Hit: `bx < mouseX < bx+20`, `H-69 < mouseY < H-47`.

## Skill buttons (`0x6FAD8D30`, hit `0x6FAD80AE`)
Left icon `x=117`, right `x=W-165`, bottom `y=H` (48x48 → top `H-48`: 800 → 552, 640 → 432). Hit
`H-48 < y <= H`.

## Belt pop-up (`0x6FAD8E60`) and belt cells
`Panel\ctrlpnl_popbelt.dc6` (125x32) rows `i=0..2` at `x=W/2+21`, bottom `H-41-32*i` (800 → tops 527,
495, 463). Cell boxes come from `belts.txt` (`box*left/right/top/bottom`): 640 rows (classic block)
`343,442`; 800 rows (`*2` block) `423,562`, pitch 31x32.
