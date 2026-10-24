# D2Client.dll 1.13c — draw modes, client missile anim speed, CltDoFunc 25 nova ring, States castoverlay

Ground truth: 1.13c binaries in `~/d2-data` (ImageBase D2Client `0x6FAB0000`, D2Common `0x6FD50000`,
D2gfx `0x6FA80000`, D2Direct3D `0x6F880000`, D2Gdi `0x6F870000`). Disassembled with `objdump -d -M intel`.
Note that 1.13c D2Common export ordinals differ from 1.10f ordinals (see the note in
[`d2gfx-draw-mode-113c.md`](./d2gfx-draw-mode-113c.md)).

## 1. Draw modes (summary)

The full disassembly is in [`d2gfx-draw-mode-113c.md`](./d2gfx-draw-mode-113c.md). Short version:

- `D2gfx #10041` (`0x6FA8B080`, `D2GFX_DrawCelContext`) forwards `eDrawMode` unclamped to `[gpGfxInterface+0x84]`.
- **Overlay.txt `Trans` = eDrawMode (identity).** D2Client reads `pOverlayTxt[id].nTrans` (`+0x7C`, stride 0x84) and
  pushes it unchanged (`0x6FB1B11D` / `0x6FB1B2B2` → `call 0x6FABD096` = #10041).
- **Missiles.txt `Trans` is remapped** (`0x6FB1CF32..0x6FB1CF4C`, missiles.bin `+0x18D`): 0 → 5 (normal),
  1 → 3 (additive), 2 → 4 (multiply); the hovered unit gets 7.
- What each mode does (D2Direct3D `0x6F886B90`, jump table `0x6F886CF4` = {3:`0x6F886BF4`, 4:`0x6F886C41`,
  5:`0x6F886BA7`, 6:`0x6F886C8E`, 7:`0x6F886BA7`}; D2Gdi `0x6F8762E0`, jump table `0x6F87633C`):

| mode | Symbolic name | D3D | GDI table (`[0x6F87C550]`+) | port blend |
|---:|---|---|---|---|
| 0 / 1 / 2 | TRANS25 / 50 / 75 | SRCALPHA/INVSRCALPHA, α 0x40 / 0x80 / 0xC0 | +0x08 / +0x04 / +0x00 | `trans25` / `trans50` / `trans75` |
| 3 | "MODULATE" (misnomer) | **ONE/ONE (additive)** | +0x104 | `additive` |
| 4 | "BURN" (misnomer) | **ZERO/SRCCOLOR (multiply)** | +0x108 | multiply (`burn` label in port) |
| 5 | NORMAL | blend off | none | `normal` |
| 6 | TRANSHIGHLIGHT | SRCALPHA/INVSRCALPHA α 0xFF (opaque) | +0x10C | `normal` |
| 7 | HIGHLIGHT | blend off + hover-brightened texture variant 2 | none | `normal` (hover is UI state) |
| ≥8 | — | default branch, α 0xFF (opaque) | none (`cmp eax,6 / ja`) | `normal` |

Port: one table, `src/common/gfx/draw-mode.ts` (`overlayTransToDrawBlend`, `missileTransToDrawBlend`). Bake targets
named after a real row take the row's values and fail fast on drift (`missileTargetTrans` in `pack-missiles.ts`,
`overlayTargetRowFields` in `pack-overlays.ts`, Issue #1056).

## 2. Missile animation speed (client)

- Client missile creation `0x6FB630F0` has 192 callers (every CltDoFunc/CltHitFunc).
  At `0x6FB633D7` it calls D2Common #10595 (`0x6FD835F0`, UNITS_SetAnimData). For missiles that function sets
  `wAnimSpeed = (animrate<<8)/1024` and `[+0x48] = AnimLen<<8` (`0x6FD83889..0x6FD838ED` in `D2Common.dll`).
- It then **overrides** the speed immediately:
  ```asm
  6FB633EE  mov dh, byte [rec+0x178] ; mov [unit+0x48], edx   ; dwFrameCountPrecise = AnimLen<<8
  6FB633F7  movzx eax, byte [rec+0x1A1] ; shl eax,4          ; AnimSpeed*16
  6FB63403  call #10154 (0x6FDBA650: missile-only, clamp, mov [unit+0x4C],ax = wAnimSpeed)
  ```
  So the **visual** frame advance is `AnimSpeed*16/256 = AnimSpeed/16` frames per 25 Hz tick. `animrate` only matters on
  the server (D2Game). Two hard-coded exceptions call `#10154(unit, 0x80)` (half speed) at `0x6FB63C2D` and `0x6FB6447F`.
- `+0x1A1` is read only at `0x6FB633F7` in D2Client. D2Common does not read it.

## 3. CltDoFunc 25 (nova / warcry rings): the client spawns its own 64-missile ring

- The CltDoFunc table is at `0x6FB8EA48` (count `[0x6FB8EC50]` = 130). Dispatch: `0x6FB52DDE..0x6FB52E19` (`movsx eax, word [skill+0xF4]`).
- `[25] = 0x6FB23CB0`:
  - missile = cltmissilea (`0x6FAF0550`; it can pick b/c/d from a linked skill level, otherwise `+0xEA`).
  - velocity = D2Common #11169 (`Vel + VelLev*lvl/8`) + #10786(cltcalc1).
  - It calls `0x6FB51020` → `0x6FB50DB0`.
- `0x6FB50DB0` loops `edi = 0..0x100 step 4`, which is **64 iterations**. Each iteration sets target offsets from the circle tables
  X `0x6FB84390` and Y `0x6FB84290` (64 entries, radius 30: 30,29,29,28,27,26,24,23,21,19,16,14,11,8,5,2,0,…).
  It then calls `0x6FB630F0`. Range = `Range + LevRange*lvl` (`0x6FB63417`).
  For missile 176 (`diabfire`) it toggles param flag `0x4000` on alternate entries.
- Skills with cltdofunc=25: 44 Frost Nova, 48 Nova, 92 Poison Nova, 130 Howl, 138 Shout, 146 Battle Cry, 149 Battle Orders,
  154 War Cry, 155 Battle Command, 190 PrimeIceNova, 195 DiabFire, 316 Baal Nova, 346 MephFrostNova, 353 Trap Nova.

## 4. States.txt castoverlay IS applied by D2Client on state set

- State-set handler `0x6FB23760`. If the state was not already set it plays `onsound` (+0x26). It then calls #10945 (toggle), applies colorshift (+0x21),
  then `0x6FB22C80` (`call` at `0x6FB2382D`).
- `0x6FB22C80` does the following:
  1. If `States.txt nooverlays` (flagsEx byte `+0x14` & Fog `gdwBitMasks[3]`) is set, it returns without adding any overlay.
  2. It reads `wCastOverlay` (+0x0A), `overlay1` (+0x02) and `overlay2` (+0x04). Each one gets a random `1ofN` variant (#10799 + seed roll `0x6FAB1380`).
  3. It sets `isAura` = #10190 (the STATEMASK_AURA bit). For aura states it toggles the state off, and if #10625 (the unit has any other
     aura-mask state) it **drops the castoverlay**, then toggles the state back on.
  4. If castoverlay ≠ −1, it calls `0x6FB1B300(unit, type, 0, ov1, ov2, [state])` with eax = castoverlay. type is **9 (AURAEX)** for aura states
     and **4 (LOOPEX)** otherwise. The castoverlay plays and then hands over to overlay1/overlay2.
  5. Otherwise it adds ov1 and ov2 individually as type 8 (AURA, param = state) for aura states or type 3 (LOOP) otherwise.
- The remove handler `0x6FB22A50` removes castoverlay, overlay1..4 and all 1ofN variants (`0x6FB227F0` → `0x6FB19660`).
- Skill-cast `castoverlay` (Skills.txt +0x106, or itemcastoverlay +0x124) is a different path: `0x6FB5219E` → `0x6FB1B300(…,type 2 ONCE)`.
