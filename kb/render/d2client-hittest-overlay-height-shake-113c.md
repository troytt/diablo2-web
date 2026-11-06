# D2Client 1.13c: unit hit-test boxes, overlay height, shadow gating, screen shake

Ground truth: `samples/d2/D2Client.dll` (image base `0x6FAB0000`), `D2Common.dll` (`0x6FD50000`),
`D2gfx.dll` (`0x6FA80000`), `D2Gdi.dll` (`0x6F870000`); data `MonStats2.txt`, `Overlay.txt`, `Missiles.txt`, COF files.

## 1. HitTest `0x6FB568E0` (unit, x, y)

Jump table at `0x6FB56D48` on unit type:

| type | entry | test |
|---|---|---|
| 0 player | `0x6FB56AF2` | `0x6FB1A550` (COF box, below) |
| 1 monster | `0x6FB56A77` | MonStats2 `noGfxHitTest` set → `PtInRect({htLeft+sx, htTop+sy, +htWidth, +htHeight})` (records `+0x110/+0x10E/+0x112/+0x114`, exclusive right/bottom); otherwise `0x6FB1A550` |
| 2 object | `0x6FB56B15` | `0x6FB1A550` first; if it fails and Objects `+0x13A` (IsDoor) and `+0x19D` are both 0 → miss; then door / CollisionSubst box (`0x6FB55720`) or frame bounds (`0x6FB56730`) |
| 3 missile / 4 item | `0x6FB56B5C` / `0x6FB56B99` | item only in mode 3; per-layer frame bounds loop (`0x6FB56730`, 16 layers) |
| 5 tile | `0x6FB56BBB` | LvlWarp select box `0x6FB557E0` |

`0x6FB1A550` (gfx test): looks up the unit's cached animation (`unit+0x54` → list `+0x28`, keyed by
`0x6FAB1AF0()` and the mode/weapon token from `0x6FABC2AA`; built by `0x6FB1A2F0` on miss), takes
`entry+0x08 → +0x14` = the loaded COF header and tests

```
x >= sx + cof.xMin - 16 && x < sx + cof.xMax + 16 &&
y >= sy + cof.yMin - 16 && y < sy + cof.yMax + 16
```

COF header int32 fields: `+0x08 xMin`, `+0x0C xMax`, `+0x10 yMin`, `+0x14 yMax` (bytes 0..3 = layers,
frames/dir, dirs, version 20; byte `+0x18` = anim speed). Examples: `ZMNUHTH.cof` box x -30..18,
y -61..5; `DINUHTH.cof` x -179..128, y -150..62; `SKNU1HS.cof` x -55..46, y -75..15.

HoverUpdate `0x6FB01E80` iterates the rooms' units and calls only HitTest (`0x6FB01ECD`, `0x6FB0202B`);
there is no distance/radius fallback.

## 2. Overlay instance placement `0x6FB1B300`

Overlay row = `overlay.bin` (`[tables+0xBBC]`, stride `0x84`). The instance (0xA8 bytes) gets
`+0x20 = row.xOffset (+0x54)`, `+0x24 = row.yOffset (+0x58)`, then `h = D2Common #10172(unit)` and
(jump table `0x6FB1B58C`):

| h | y added |
|---|---|
| -1 | +75 |
| 0 | Height1 (`+0x5C`) |
| 1 | Height2 (`+0x60`) |
| 2 | Height3 (`+0x64`) |
| 3 | Height4 (`+0x68`) |

D2Common `#10172` (`0x6FD80830`): player → 1; monster → MonStats2 `OverlayHeight` (record byte `+0x0C`) − 1;
any other type → 0. The values add to yOffset and keep their sign. Other fields: `+0x14 = AnimRate << 4`
(8.8 frames per frame), `+0x28 = LoopWaitTime (+0x78)` (`0x6FB1B57B`), `+0x34 = PreDraw`, light from InitRadius/Radius + RGB.

`LoopWaitTime` consumer (`0x6FB1C1FF`, `0x6FB1C321`, `0x6FB1B062`, `0x6FB1B1EC`): in `OVERLAY_Step` (`0x6FB1C150`),
when an overlay wraps at `frame8 >= totalFrames << 8` (`0x6FB1C321`), it subtracts `totalFrames << 8`, clears
`inst+0x08` (`dwActive = 0`), and stores `GetTickCount()` into `inst+0x30`. While `inst+0x08 == 0`, pre-step
`0x6FB1C1FF` checks `GetTickCount() - inst+0x30 < inst+0x28` (`LoopWaitTime` ms) and skips frame stepping while
`OVERLAY_Draw` (`0x6FB1B062` / `0x6FB1B1EC`) hides the overlay; once `LoopWaitTime` ms have elapsed, `0x6FB1C21A`
sets `inst+0x08 = 1` and resumes stepping.

MonStats2 OverlayHeight counts: 0 → 15 rows, 1 → 119, 2 → 300, 3 → 153, 4 → 22. 45 Overlay.txt rows
use Height `14,0,-14,-60` (curses, armour hits, shrine shimmers, doubledamage); `cloaked` = `-46,-60,-74,-120`;
`npcalert` = yOffset -7, Height `-30,0,0,-50`, AnimRate 9, LoopWaitTime 7000.

## 3. Unit shadow pass

`0x6FB1AA30` / `0x6FB1BA96` return without drawing when `unit+0xC4 & 0x20` is set or the unit has
state 146 (`invis`); the draw goes through D2gfx `#10011` (renderer vtable `+0x90` with y+2; D2Gdi
`0x6F876360` halves the height). Monster spawn (`0x6FAFE946..0x6FAFE95D`) sets flag `0x20` when MonStats2
flag 14 (`Shadow`) is clear. Shadow-less MonStats2 rows: wraith1-5, willowisp1-4, hellmeteor, baboon6, snake,
window1/2, invisopet, catapultspotter1-4, baaltaunt, worldstoneeffect.

## 4. Screen shake

State: start `0x6FBBB9CC` (GetTickCount), rampUp `0x6FBBB9D0`, sustain `0x6FBBB9D4`, rampDown
`0x6FBBB9D8`, amplitude `0x6FBCBEFC`. `StartScreenShake` `0x6FB39F00` (esi = sustain; stack amp, rampUp,
rampDown; no-op when sustain is 0). `UpdateScreenShake` `0x6FB3AFD0`: ends when elapsed > total;
amp ramps linearly; offsets = `RAND(2a) - a` twice from the local player unit seed (`unit+0x20`); then
`0x6FB3AD30(a)` plays sound 452 `andariel_quake_loop` (once) at volume `clamp(a*255/20, 0, 255)` and stops it at 0.

Every writer of the shake state in 1.13c:

| site | trigger | rampUp / sustain / rampDown ms, amp |
|---|---|---|
| `0x6FB2E62F` | S2C 0x5A event 0x12 "Diablo Walks the Earth" (+ sound 4640 `monster_diablo_taunt_ex`) | 4000 / 10000 / 4000, 6 |
| `0x6FB62D00` (CltDo 12, no Missiles.txt user) | CltParam2 split in thirds ×1000 | amp CltParam1 |
| `0x6FB6C328` CltDo 29 `andycontrol0` | elapsed (`#10985`) == 90 | `n=CltParam2(7)`: (n/3)·1000 / (n−2(n/3))·1000 / (n/3)·1000 = 2000/3000/2000, 8 |
| `0x6FB6421B` CltDo 36 `durieldeathcontrol` | rem (`#10737`) == 325 | 0 / 6000 / 0, 20 |
| `0x6FB62518` CltDo 37 `diablo appears` | rem == 150 | 0 / 4000 / 0, 25 |
| `0x6FB64BB4` CltDo 31 `horadricstaff` | rem == 150 | 0 / 4000 / 0, 25 |
| `0x6FB69E38` CltDo 54 (Anya) | elapsed == 5 | 600 / 4000 / 3000, 3 |
| `0x6FB69F1F` worldstone | — | 2000 / 3000 / 2000, 6 |
| `0x6FB6A84C` hellforge | — | 80 / 80 / 400, 4 |
| `0x6FB74926` skill CltDo 75 (Siege Beast stomp) | Skills.txt params | computed |

No monster death handler (`0x6FB02xxx`) starts a shake.

## 5. Duriel death controller (CltDo 36, `0x6FB641F0`)

Rows `{threshold, a, b}` at `0x6FB83610`: (350,3,5), (300,2,3), (200,3,2), (175,5,1), (0,100,5); first row with
`rem > threshold`, else the last. Each frame: `rem % a == 0` → client missile 42 `explodingarrowexp` at
`(x + RAND(40) − 20, y + RAND(40) − 20)`; `rem % b == 0` → 364 `durieldeathrock` at a new random offset with
z `0x4B000` (150 px), vz `−0x5000` (−10 px/frame), 15 frames, anim rate 128. Then CltDo 1.
